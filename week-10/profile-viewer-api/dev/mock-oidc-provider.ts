/**
 * A tiny OpenID Connect provider for development and tests. NOT for production.
 *
 *   bun run mock-oidc        (listens on http://localhost:9000)
 *
 * It implements just enough of the standard for the authorization code flow:
 * discovery, an authorize page, a token endpoint with PKCE checking, signed ID
 * tokens, a JWKS endpoint and UserInfo. It accepts any client id and secret
 * and always signs in the same fake user.
 *
 * Why it exists: the API is written against the OpenID Connect *standard*, not
 * against Google. Pointing OIDC_ISSUER at this mock lets you develop and test
 * the whole login flow without a Google Cloud project, and shows that the same
 * code works with any compliant provider.
 */
import type { Server } from "bun";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export interface MockUser {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

const DEFAULT_USER: MockUser = {
  sub: "mock-user-1",
  email: "ada.lovelace@example.com",
  name: "Ada Lovelace",
};

interface IssuedCode {
  clientId: string;
  redirectUri: string;
  nonce: string;
  codeChallenge: string;
}

function base64url(bytes: ArrayBuffer): string {
  return new Uint8Array(bytes).toBase64({ alphabet: "base64url", omitPadding: true });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function startMockOidcProvider(options: { port?: number; user?: MockUser } = {}) {
  const user = options.user ?? DEFAULT_USER;
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "mock-key", alg: "RS256", use: "sig" };

  const pendingAuthorizations = new Map<string, IssuedCode>(); // approval id → request
  const codes = new Map<string, IssuedCode>(); // authorization code → request
  const accessTokens = new Set<string>();

  // The explicit type is needed because the handlers below refer to `server`.
  const server: Server<undefined> = Bun.serve({
    port: options.port ?? 9000,
    routes: {
      // Discovery: where everything is.
      "/.well-known/openid-configuration": () => {
        const issuer = server.url.origin;
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
          response_types_supported: ["code"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
          scopes_supported: ["openid", "email", "profile"],
        });
      },

      // The public keys that verify ID token signatures.
      "/jwks": () => Response.json({ keys: [jwk] }),

      // The "sign-in page". A real provider asks for a password and consent.
      "/authorize": (req) => {
        const params = new URL(req.url).searchParams;
        const redirectUri = params.get("redirect_uri");
        const state = params.get("state");
        const codeChallenge = params.get("code_challenge");
        if (!redirectUri || !state || !codeChallenge || params.get("code_challenge_method") !== "S256") {
          return new Response("Missing redirect_uri, state or S256 code_challenge", { status: 400 });
        }

        const approvalId = crypto.randomUUID();
        pendingAuthorizations.set(approvalId, {
          clientId: params.get("client_id") ?? "",
          redirectUri,
          nonce: params.get("nonce") ?? "",
          codeChallenge,
        });

        const approve = `/authorize/approve?id=${approvalId}&state=${encodeURIComponent(state)}`;
        const cancel = `${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`;
        return new Response(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mock sign-in</title>
          <style>body{font-family:system-ui;max-width:420px;margin:80px auto;padding:24px;border:1px solid #ddd;border-radius:12px}
          a{display:inline-block;margin:8px 8px 0 0;padding:10px 16px;border-radius:8px;text-decoration:none}
          .ok{background:#1565c0;color:#fff}.no{border:1px solid #999;color:#333}</style></head>
          <body><h1>Mock OpenID provider</h1><p>A development stand-in for Google.</p>
          <p>Sign in to the Profile Viewer as <strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.email)})?</p>
          <a class="ok" id="approve" href="${escapeHtml(approve)}">Continue</a><a class="no" href="${escapeHtml(cancel)}">Cancel</a>
          </body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      },

      // The user approved: send them back to the client with a one-time code.
      "/authorize/approve": (req) => {
        const params = new URL(req.url).searchParams;
        const pending = pendingAuthorizations.get(params.get("id") ?? "");
        if (!pending) return new Response("Unknown authorization request", { status: 400 });
        pendingAuthorizations.delete(params.get("id") ?? "");

        const code = crypto.randomUUID();
        codes.set(code, pending);

        const target = new URL(pending.redirectUri);
        target.searchParams.set("code", code);
        target.searchParams.set("state", params.get("state") ?? "");
        return Response.redirect(target.href, 302);
      },

      // Code + PKCE verifier → tokens.
      "/token": {
        POST: async (req) => {
          const form = new URLSearchParams(await req.text());
          const issued = codes.get(form.get("code") ?? "");
          codes.delete(form.get("code") ?? ""); // codes are single-use

          if (!issued || form.get("grant_type") !== "authorization_code" || form.get("redirect_uri") !== issued.redirectUri) {
            return Response.json({ error: "invalid_grant" }, { status: 400 });
          }

          // PKCE: the verifier must hash to the challenge sent at the start.
          const verifier = form.get("code_verifier") ?? "";
          const challenge = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
          if (challenge !== issued.codeChallenge) {
            return Response.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400 });
          }

          const accessToken = crypto.randomUUID();
          accessTokens.add(accessToken);

          const idToken = await new SignJWT({ nonce: issued.nonce, email: user.email, name: user.name })
            .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
            .setIssuer(server.url.origin)
            .setAudience(issued.clientId)
            .setSubject(user.sub)
            .setIssuedAt()
            .setExpirationTime("5m")
            .sign(privateKey);

          return Response.json({ access_token: accessToken, token_type: "Bearer", expires_in: 300, id_token: idToken });
        },
      },

      // The profile behind an access token.
      "/userinfo": (req) => {
        const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
        if (!accessTokens.has(token)) return new Response(null, { status: 401 });
        return Response.json({ ...user, email_verified: true });
      },
    },
    fetch: () => new Response("Not found", { status: 404 }),
  });

  return { url: server.url.origin, stop: () => server.stop(true) };
}

if (import.meta.main) {
  const provider = await startMockOidcProvider();
  console.log(`Mock OpenID provider running at ${provider.url}`);
  console.log(`Set OIDC_ISSUER=${provider.url} in the API's .env to use it.`);
}
