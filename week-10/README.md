# Week 10 – Sign in with Google: OAuth 2.0, OpenID Connect, PKCE and i18n

Instead of storing passwords ourselves, this week's **Profile Viewer** lets a
trusted **identity provider** (Google) authenticate users. The back-end runs
the **OAuth 2.0 authorization code flow with PKCE**, validates the
**OpenID Connect** ID token, and keeps the user signed in with a **server-side
session** in an `HttpOnly` cookie. The React client shows the profile and is
available in **English and Finnish**.

A small **mock OpenID provider** is included, so the complete flow can be run
and tested without a Google Cloud project. Using Google is a configuration
change, not a code change.

## Learning objectives

After this week you can:

- explain the roles in OAuth 2.0 / OIDC (user, client, authorization server, resource server)
- walk through the authorization code flow and explain what `state`, `nonce` and PKCE each protect against
- tell an ID token from an access token, and know what the client must check in an ID token
- implement the flow with `openid-client`, with discovery, and register an OAuth client in Google Cloud
- compare token-based (week 7) and cookie-session authentication, and choose cookie attributes (`HttpOnly`, `Secure`, `SameSite`)
- configure CORS for requests with credentials
- internationalise a React app with `react-i18next`: keys, interpolation, language switching, localised dates, type-checked keys

## What you build

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/auth/google/login` | Start a login: `302` to the provider's sign-in page |
| `GET` | `/auth/google/callback` | The provider returns here; validate, create a session, `302` to the client |
| `GET` | `/api/me` | The signed-in user's profile, or `401` |
| `POST` | `/auth/logout` | Destroy the session, clear the cookie, `204` |

Client: `/` (sign-in page, shows `?error=` messages) and `/profile` (requires a
session).

## Running it

**Without Google** (the mock provider):

```bash
# terminal 1 – the mock identity provider on http://localhost:9000
cd week-10/profile-viewer-api
bun run mock-oidc

# terminal 2 – the API
cd week-10/profile-viewer-api
cp .env.example .env          # then uncomment OIDC_ISSUER=http://localhost:9000
bun run dev                   # http://localhost:8000
bun test                      # 10 tests; the tests start their own mock provider

# terminal 3 – the client
cd week-10/profile-viewer-client
bun run dev                   # http://localhost:5173
```

**With Google:** do the GCP setup at the end of this document, put the client
id and secret into `.env`, comment out `OIDC_ISSUER`, and restart the API.

## Project structure

```
week-10/
├── shared/types.ts                  UserProfile, ApiResult<T>
├── profile-viewer-api/
│   ├── .env.example                 BASE_URL, FRONTEND_URL, GOOGLE_CLIENT_ID/SECRET, OIDC_ISSUER
│   ├── dev/
│   │   └── mock-oidc-provider.ts    a minimal OpenID provider for development and tests
│   ├── src/
│   │   ├── main.ts
│   │   ├── config.ts                REDIRECT_URI, cookie and session settings
│   │   ├── routes.ts                login, callback, me, logout (cookies via req.cookies)
│   │   ├── oidc/client.ts           discovery (cached)
│   │   ├── services/
│   │   │   ├── login-service.ts     startLogin(), finishLogin(): state, nonce, PKCE
│   │   │   └── session-service.ts   in-memory sessions with expiry
│   │   ├── middleware/              logger, applyMiddleware
│   │   └── util/response.ts         CORS with credentials, redirect()
│   └── tests/oidc-flow.test.ts      the whole flow against the mock provider
└── profile-viewer-client/src/
    ├── main.tsx                     imports ./i18n before rendering
    ├── App.tsx                      "/" and a RequireSession layout route around "/profile"
    ├── api.ts                       fetch with credentials: "include"
    ├── i18n/                        index.ts (setup, typed keys), en.ts, fi.ts
    ├── components/                  LanguageSwitcher, PageShell, RequireSession
    └── pages/                       LoginPage, ProfilePage
```

---

## Concepts: OAuth 2.0 and OpenID Connect

### Who is who

| Role | In this app |
| ---- | ----------- |
| **Resource owner** | the user, who owns the Google account |
| **Client** | our API (a *confidential* client: it has a client secret) |
| **Authorization server** | Google's sign-in and token service |
| **Resource server** | Google's UserInfo endpoint |

**OAuth 2.0** is about *authorization*: letting the client access something on
the user's behalf, with an **access token**. **OpenID Connect (OIDC)** is a thin
layer on top that adds *authentication*: an **ID token** (a signed JWT) saying
who the user is. Asking for the `openid` scope turns an OAuth flow into an OIDC
login.

| | ID token | Access token |
| - | -------- | ------------ |
| For | the client (us) | the resource server (UserInfo) |
| Says | who signed in (`sub`, `email`, `nonce`, `aud`, `exp`…) | "the bearer may call these APIs" |
| Format | always a signed JWT | provider-specific; treat as opaque |

### The authorization code flow with PKCE

```
 Browser                       Our API                               Google
    │ GET /auth/google/login      │                                      │
    │────────────────────────────▶│ state, nonce, code_verifier          │
    │                             │ code_challenge = SHA-256(verifier)   │
    │◀── 302 accounts.google.com/…?client_id&redirect_uri&scope          │
    │        &state&nonce&code_challenge&code_challenge_method=S256 ─────│
    │                                                                    │
    │─── user signs in, consents ───────────────────────────────────────▶│
    │◀── 302 /auth/google/callback?code=…&state=… ───────────────────────│
    │ GET /auth/google/callback   │                                      │
    │────────────────────────────▶│ state known and fresh? (single use)  │
    │                             │── POST /token: code + code_verifier ▶│
    │                             │◀── id_token + access_token ──────────│
    │                             │ verify ID token: signature (JWKS),   │
    │                             │   iss, aud, exp, nonce               │
    │                             │── GET /userinfo (access token) ─────▶│
    │                             │◀── profile ──────────────────────────│
    │◀── 302 client/profile + Set-Cookie: session=… ─────────────────────│
```

The three random values, and the attack each one stops:

| Value | Where it goes | Protects against |
| ----- | ------------- | ---------------- |
| `state` | to Google and back in the callback; we store it | **Login CSRF**: an attacker making your browser finish *their* login. A callback whose `state` we never issued, or already used, is rejected. |
| `nonce` | to Google; comes back *inside* the signed ID token | **Token replay**: an old ID token cannot be passed off as the answer to this login. |
| PKCE `code_verifier` | stays on our server; only its SHA-256 hash (`code_challenge`) goes to Google | **Code interception**: a stolen authorization code is useless without the verifier, which never travelled through the browser. |

PKCE was invented for public clients (mobile and single-page apps) that cannot
keep a secret, but it is recommended for every client today (OAuth 2.1 makes it
mandatory).

### Implementing it with `openid-client`

OIDC providers publish their endpoints and signing keys in a **discovery
document**, e.g.
<https://accounts.google.com/.well-known/openid-configuration>.
`openid-client` reads it and does all the protocol and validation work:

```ts
const config = await oidc.discovery(new URL(OIDC_ISSUER), CLIENT_ID, CLIENT_SECRET);

// start
const codeVerifier = oidc.randomPKCECodeVerifier();
const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
const url = oidc.buildAuthorizationUrl(config, {
  redirect_uri: REDIRECT_URI, scope: "openid email profile",
  code_challenge: codeChallenge, code_challenge_method: "S256", state, nonce,
});

// callback
const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
  pkceCodeVerifier: pending.codeVerifier,
  expectedState: state,
  expectedNonce: pending.nonce,
  idTokenExpected: true,
});
const claims = tokens.claims();                                       // the verified ID token
const userInfo = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);
```

Never implement these checks by hand when a certified library exists. The
details (clock skew, algorithm confusion, issuer formats) are where real-world
vulnerabilities come from.

Pending logins live in a `Map` keyed by `state`, expire after 10 minutes, and
are **removed when used**, so a replayed callback fails. (Last year's version
kept them forever.)

### The mock provider

`dev/mock-oidc-provider.ts` implements discovery, an authorize page, a token
endpoint that checks PKCE, RS256-signed ID tokens with a JWKS endpoint, and
UserInfo, in under 200 lines (with comments) using Bun and `jose`. Set
`OIDC_ISSUER=http://localhost:9000` and the API cannot tell the difference.
That is the point of a standard.

`tests/oidc-flow.test.ts` drives the whole flow against it: the redirect
parameters, the callback, the cookie, `/api/me`, a replayed callback, a forged
state, a code from one login combined with the state of another (PKCE rejects
it), cancellation, logout and CORS.

## Concepts: sessions and cookies

### Server-side sessions vs. tokens in the browser

After a successful login the API creates a **session**: a random id mapped to
the user's profile, kept on the server. The browser gets only the id, in a
cookie:

```ts
req.cookies.set("session", sessionId, {
  httpOnly: true,     // JavaScript cannot read it → an XSS bug cannot steal it
  secure: COOKIE_SECURE, // only sent over HTTPS (on when BASE_URL is https://)
  sameSite: "lax",    // not sent on cross-site POSTs, iframes or images → CSRF protection
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
});
```

`req.cookies` is Bun's built-in cookie API: `get`, `set` and `delete` on the
request, and Bun adds the `Set-Cookie` headers to the response. (Last year's
version parsed and built cookie headers by hand.)

| | JWT in localStorage (week 7) | Session cookie (week 10) |
| - | ---------------------------- | ------------------------ |
| Where the state lives | in the token, in the browser | on the server |
| Readable by page scripts | yes (XSS risk) | no (`HttpOnly`) |
| Sent automatically | no, code adds a header | yes, by the browser |
| Logout / revoke | wait for expiry | delete the session |
| Server storage | none | needed (memory, Redis, DB) |
| CSRF | not an issue (header is manual) | needs `SameSite` (or CSRF tokens) |

Sessions here are in memory: they vanish on restart and cannot be shared by
several server instances. Production systems keep them in Redis or the
database.

Logout is a `POST`: a `GET` could be triggered by any `<img src>` on any site.

### CORS with credentials

The client calls the API with `fetch(url, { credentials: "include" })` so the
cookie is sent. For such requests browsers require:

```
Access-Control-Allow-Origin: http://localhost:5173     (the exact origin, never *)
Access-Control-Allow-Credentials: true
Vary: Origin
```

**Same-site vs. same-origin.** `localhost:5173` and `localhost:8000` are
different *origins* (port differs), so CORS applies. They are the same *site*
(cookies ignore ports), so a `SameSite=Lax` cookie is still sent. In
production the API and the client should share a registrable domain (e.g.
`app.example.com` and `api.example.com`) for the same reason.

### Protecting client routes when you cannot see the cookie

The client cannot tell whether a session exists, because the cookie is
`HttpOnly`. It asks the API:

```tsx
<Route element={<RequireSession />}>         {/* layout route: fetches /api/me once */}
  <Route path="/profile" element={<ProfilePage />} />
</Route>
```

`RequireSession` renders a spinner, redirects on `401`, or renders the child
route with `<Outlet context={user} />`. `ProfilePage` reads the profile with
`useOutletContext<UserProfile>()` instead of fetching it again.

Signing in is a plain link to `http://localhost:8000/auth/google/login`: the
whole browser window must go to Google, so it cannot be a `fetch`.

## Concepts: internationalisation (i18n)

```ts
// en.ts
const en = { profile: { welcome: "Welcome, {{name}}!" }, … };
// fi.ts — same keys, checked by the compiler
const fi: typeof en = { profile: { welcome: "Tervetuloa, {{name}}!" }, … };
```

```tsx
const { t, i18n } = useTranslation();
t("profile.welcome", { name: user.name })    // interpolation
i18n.changeLanguage("fi")                     // re-renders every translated component
```

Details worth copying:

- **Keys, not sentences, in code.** Translators edit `fi.ts`; components do not change.
- **Type-safe keys.** `declare module "i18next" { interface CustomTypeOptions … }`
  makes `t("profile.titel")` a compile error, and `fi: typeof en` makes a
  missing Finnish key a compile error.
- **Initial language**: the saved choice, else the browser's language
  (`navigator.language`), else English. `fallbackLng` covers missing keys.
- **`<html lang>`** is updated on every change, for screen readers and spell checkers.
- **Formats are localised too**: `Intl.DateTimeFormat(i18n.resolvedLanguage, …)`
  shows "Oct 12, 2026, 12:11 PM" in English and "12.10.2026 klo 12.11" in Finnish.
- **Error codes, not messages, in URLs.** The API redirects to `/?error=login_failed`;
  the client looks the code up in its translations and ignores unknown codes.

## Lecture walkthrough

1. Draw the flow. Open Google's discovery document.
2. `config.ts`, `oidc/client.ts`; `login-service.ts` → `startLogin()`. Follow
   `/auth/google/login` in the browser and read the parameters in the URL.
3. `finishLogin()`: state lookup and deletion, `authorizationCodeGrant`,
   `fetchUserInfo`.
4. `session-service.ts` and the routes with `req.cookies`. Inspect the cookie in
   DevTools → Application → Cookies (note the HttpOnly column), and try
   `document.cookie` in the console.
5. Run the flow against the mock provider, then against Google.
6. Client: `api.ts` with `credentials: "include"`, `RequireSession`, the pages.
7. i18n: `en.ts`, `fi.ts`, `i18n/index.ts`, `LanguageSwitcher`; demonstrate a
   typo in a key and a missing Finnish key.

## Compared with last year's Deno version

- `openid-client` from npm (`jsr:@panva/openid-client` is the same library).
- Bun's `req.cookies` replaces the hand-written cookie parser.
- Fixed: pending logins and sessions expire; `/api/me` uses the response
  envelope; cookies get `Secure` on HTTPS; the login page explains failures;
  the language choice persists and sets `<html lang>`.
- New: the mock provider and an automated test of the whole flow; typed
  translation keys; the layout route that fetches the profile once.

## Configuring Google Cloud (do this last)

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create
   a project (e.g. "awa-profile-viewer").
2. **APIs & Services → OAuth consent screen** (now called *Google Auth
   Platform*): choose **External**, fill in the app name and your email, and add
   yourself as a **test user** while the app is in testing mode.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
4. Application type: **Web application**.
5. **Authorized redirect URIs**: `http://localhost:8000/auth/google/callback`.
   It must match `REDIRECT_URI` exactly: scheme, host, port and path.
6. **Authorized JavaScript origins**: `http://localhost:8000`. (Only the API
   talks to Google; the client never does.)
7. Copy the **Client ID** and **Client secret** into
   `week-10/profile-viewer-api/.env`:

   ```env
   GOOGLE_CLIENT_ID=1234567890-abc….apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-…
   # OIDC_ISSUER=http://localhost:9000     ← commented out
   ```

   The secret is a credential: never commit it. Google may show it only once.
8. Restart the API. New credentials can take a few minutes to start working.

Typical errors: `redirect_uri_mismatch` (step 5 does not match `BASE_URL`),
`access_blocked` (you are not a test user of the consent screen), `invalid_client`
(a typo in the id or secret).

## Exercises

1. Store users in a database: on each login, upsert a row keyed by `sub` (never
   by email: emails can change) and record `last_login_at`.
2. Move sessions to PostgreSQL (`sessions(id, user_sub, expires_at)`), so they
   survive restarts. Delete expired rows on a schedule.
3. Add a second provider (GitHub uses OAuth 2.0 without OIDC; Microsoft Entra
   ID supports OIDC). What changes, and what stays?
4. Add Swedish (`sv.ts`). What does the compiler tell you when a key is missing?
5. Show the language switcher's current choice with a flag emoji, and make
   date formats follow the language everywhere in the app.

## Further reading

- [OAuth 2.0 simplified (Aaron Parecki)](https://aaronparecki.com/oauth-2-simplified/)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OpenID Connect Core: ID token validation](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)
- [openid-client documentation](https://github.com/panva/openid-client)
- [Google Identity: OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Bun: Cookies](https://bun.sh/docs/runtime/cookies)
- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)
- [react-i18next documentation](https://react.i18next.com/)
