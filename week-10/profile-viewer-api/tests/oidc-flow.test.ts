// End-to-end test of the whole OpenID Connect login, against the mock provider
// in dev/. Every check of the real flow runs: state, PKCE, the ID token's
// signature, issuer, audience and nonce, the UserInfo subject check.
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import type { Server } from "bun";
import type { ApiResult, UserProfile } from "@shared/types";
import { startMockOidcProvider } from "../dev/mock-oidc-provider";

const provider = await startMockOidcProvider({ port: 0 });

// The API's redirect URI is built from BASE_URL when config.ts is imported, so
// the port must be known first: borrow a free port from the operating system.
const probe = Bun.serve({ port: 0, fetch: () => new Response() });
const apiPort = probe.port;
probe.stop(true);

const BASE_URL = `http://localhost:${apiPort}`;
const FRONTEND_URL = "http://localhost:5173";
Object.assign(process.env, {
  BASE_URL,
  FRONTEND_URL,
  OIDC_ISSUER: provider.url,
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
});

const { app } = await import("../src/app");

let server: Server<undefined>;

// Several tests trigger failed logins on purpose; keep their error logs out of
// the test output.
const consoleError = spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => {
  server = Bun.serve({ port: apiPort, fetch: (req) => app.handle(req) });
});

afterAll(() => {
  server.stop(true);
  provider.stop();
  consoleError.mockRestore();
});

// fetch() without following redirects, so each step can be inspected.
function get(url: string, cookie?: string): Promise<Response> {
  return fetch(url, { redirect: "manual", headers: cookie ? { Cookie: cookie } : {} });
}

function location(res: Response): string {
  const value = res.headers.get("location");
  if (!value) throw new Error(`expected a redirect, got ${res.status}`);
  return value;
}

// Walk through the browser's part of the flow and return the callback URL.
async function signInAtProvider(): Promise<string> {
  const login = await get(`${BASE_URL}/auth/google/login`);
  const authorizePage = await (await get(location(login))).text();
  // The link is HTML-escaped ("&" is written as "&#38;"); decode it like a browser would.
  const approveHref = /id="approve" href="([^"]+)"/
    .exec(authorizePage)?.[1]
    ?.replace(/&#(\d+);/g, (_entity, code: string) => String.fromCharCode(Number(code)));
  if (!approveHref) throw new Error("approve link not found");
  return location(await get(provider.url + approveHref));
}

describe("the login redirect", () => {
  test("sends the browser to the provider with state, nonce and an S256 PKCE challenge", async () => {
    const res = await get(`${BASE_URL}/auth/google/login`);
    expect(res.status).toBe(302);

    const url = new URL(location(res));
    expect(url.origin + url.pathname).toBe(`${provider.url}/authorize`);
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("redirect_uri")).toBe(`${BASE_URL}/auth/google/callback`);
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    // The verifier itself must never leave the server.
    expect(url.searchParams.has("code_verifier")).toBe(false);
  });
});

describe("a complete sign-in", () => {
  let callbackUrl: string;
  let cookie: string;

  test("the callback creates a session in an HttpOnly cookie and redirects to the profile", async () => {
    callbackUrl = await signInAtProvider();
    expect(callbackUrl.startsWith(`${BASE_URL}/auth/google/callback?code=`)).toBe(true);

    const res = await get(callbackUrl);
    expect(res.status).toBe(302);
    expect(location(res)).toBe(`${FRONTEND_URL}/profile`);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^session=[0-9a-f-]{36};/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    cookie = setCookie.split(";")[0]!;
  });

  test("GET /api/me returns the profile from the provider", async () => {
    const res = await get(`${BASE_URL}/api/me`, cookie);
    expect(res.status).toBe(200);

    const payload = (await res.json()) as ApiResult<UserProfile>;
    if (!payload.ok) throw new Error(payload.error.message);
    expect(payload.data).toMatchObject({
      sub: "mock-user-1",
      email: "ada.lovelace@example.com",
      emailVerified: true,
      name: "Ada Lovelace",
    });
    expect(Date.parse(payload.data.signedInAt)).not.toBeNaN();
  });

  test("the same callback cannot be used twice (state is single-use)", async () => {
    const res = await get(callbackUrl);
    expect(location(res)).toBe(`${FRONTEND_URL}/?error=login_failed`);
  });

  test("logout destroys the session and clears the cookie", async () => {
    const res = await fetch(`${BASE_URL}/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/^session=;/);

    expect((await get(`${BASE_URL}/api/me`, cookie)).status).toBe(401);
  });
});

describe("failed and forged callbacks", () => {
  test("a callback with an unknown state is rejected", async () => {
    const res = await get(`${BASE_URL}/auth/google/callback?code=anything&state=forged`);
    expect(location(res)).toBe(`${FRONTEND_URL}/?error=login_failed`);
  });

  test("a code from one login cannot be combined with the state of another", async () => {
    const first = new URL(await signInAtProvider());
    const second = new URL(await signInAtProvider());
    const mixed = `${BASE_URL}/auth/google/callback?code=${first.searchParams.get("code")}&state=${second.searchParams.get("state")}`;

    // The state is known, so the API asks the provider to exchange the code
    // with the *second* login's PKCE verifier, which does not match.
    const res = await get(mixed);
    expect(location(res)).toBe(`${FRONTEND_URL}/?error=login_failed`);
  });

  test("cancelling at the provider returns to the client with access_denied", async () => {
    const res = await get(`${BASE_URL}/auth/google/callback?error=access_denied&state=x`);
    expect(location(res)).toBe(`${FRONTEND_URL}/?error=access_denied`);
  });

  test("without a session cookie /api/me is 401", async () => {
    expect((await get(`${BASE_URL}/api/me`)).status).toBe(401);
    expect((await get(`${BASE_URL}/api/me`, "session=made-up")).status).toBe(401);
  });
});

describe("CORS with credentials", () => {
  test("allows exactly the client's origin, with credentials", async () => {
    const res = await fetch(`${BASE_URL}/api/me`, { method: "OPTIONS", headers: { Origin: FRONTEND_URL } });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(FRONTEND_URL);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });
});
