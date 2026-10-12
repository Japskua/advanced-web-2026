/**
 * The OAuth 2.0 authorization code flow with PKCE, as used by OpenID Connect.
 *
 *  Browser                     Our API                          Google
 *     │  GET /auth/google/login   │                                  │
 *     │──────────────────────────▶│ create state, nonce, PKCE pair   │
 *     │◀── 302 to Google ─────────│ remember them (pendingLogins)    │
 *     │                                                              │
 *     │── user signs in and consents ───────────────────────────────▶│
 *     │◀── 302 to /auth/google/callback?code=…&state=… ──────────────│
 *     │                           │                                  │
 *     │  GET /auth/google/callback│ check state, then exchange       │
 *     │──────────────────────────▶│── code + code_verifier ─────────▶│
 *     │                           │◀── ID token + access token ──────│
 *     │                           │ check ID token (signature, nonce)│
 *     │                           │── access token → /userinfo ─────▶│
 *     │◀── 302 to client + cookie │◀── profile ──────────────────────│
 *
 * The three random values and what they protect against:
 *
 *   state          Ties the callback to a login *this* server started. Without
 *                  it, an attacker could make a victim's browser complete a
 *                  login with the attacker's code (login CSRF).
 *   nonce          Ends up inside the ID token. Checking it proves the token
 *                  was issued for this login and is not a replayed old one.
 *   code_verifier  PKCE (Proof Key for Code Exchange). Google receives only
 *                  the SHA-256 hash (code_challenge) at the start; the code can
 *                  later be exchanged only together with the original verifier.
 *                  A code intercepted on the way back is useless on its own.
 */
import * as oidc from "openid-client";
import type { UserProfile } from "@shared/types";
import { LOGIN_TTL_MS, REDIRECT_URI } from "../config";
import { getOidcConfig } from "../oidc/client";

interface PendingLogin {
  nonce: string;
  codeVerifier: string;
  expiresAt: number;
}

// Logins that have been started but not finished, keyed by `state`.
// In memory is fine for a single server process; with several instances this
// would go to a shared store such as Redis or the database.
const pendingLogins = new Map<string, PendingLogin>();

function removeExpiredLogins(now = Date.now()): void {
  for (const [state, login] of pendingLogins) {
    if (login.expiresAt <= now) pendingLogins.delete(state);
  }
}

// Step 1: build the URL that sends the user to the provider's sign-in page.
export async function startLogin(): Promise<URL> {
  const config = await getOidcConfig();

  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();

  removeExpiredLogins();
  pendingLogins.set(state, { nonce, codeVerifier, expiresAt: Date.now() + LOGIN_TTL_MS });

  return oidc.buildAuthorizationUrl(config, {
    redirect_uri: REDIRECT_URI,
    scope: "openid email profile", // "openid" makes it OIDC; the others add email and name/picture
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });
}

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginError";
  }
}

// Step 2: the provider redirected back. Validate everything and get the profile.
export async function finishLogin(callbackUrl: URL): Promise<Omit<UserProfile, "signedInAt">> {
  const state = callbackUrl.searchParams.get("state");
  if (!state) throw new LoginError("The callback has no state parameter");

  // A state value works exactly once: take it out of the map before using it,
  // so a replayed callback finds nothing.
  const pending = pendingLogins.get(state);
  pendingLogins.delete(state);
  if (!pending || pending.expiresAt <= Date.now()) {
    throw new LoginError("Unknown or expired login attempt");
  }

  const config = await getOidcConfig();

  // Exchanges the code for tokens and checks: state matches, the code_verifier
  // fits the code_challenge, the ID token's signature, issuer, audience,
  // expiry and nonce.
  const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: pending.codeVerifier,
    expectedState: state,
    expectedNonce: pending.nonce,
    idTokenExpected: true,
  });

  const claims = tokens.claims();
  if (!claims) throw new LoginError("The provider returned no ID token");

  // The ID token proves *who* signed in (claims.sub). The UserInfo endpoint
  // returns the profile details, and openid-client checks that it describes
  // the same subject.
  const userInfo = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);

  return {
    sub: claims.sub,
    email: typeof userInfo.email === "string" ? userInfo.email : "",
    emailVerified: userInfo.email_verified === true,
    name: typeof userInfo.name === "string" ? userInfo.name : "",
    picture: typeof userInfo.picture === "string" ? userInfo.picture : undefined,
  };
}
