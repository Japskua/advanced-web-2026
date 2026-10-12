import type { BunRequest } from "bun";
import { BASE_URL, COOKIE_SECURE, FRONTEND_URL, SESSION_TTL_MS } from "./config";
import { finishLogin, startLogin } from "./services/login-service";
import { createSession, destroySession, getSession } from "./services/session-service";
import { fail, noContent, ok, redirect } from "./util/response";

const SESSION_COOKIE = "session";

// Errors are reported to the client with a short code in the URL
// (/?error=login_failed); the client translates the code into a message.
type LoginErrorCode = "access_denied" | "login_failed" | "provider_unavailable";

function backToClient(error: LoginErrorCode): Response {
  return redirect(`${FRONTEND_URL}/?error=${error}`);
}

// GET /auth/google/login – the client's "Sign in with Google" button is a plain
// link to this URL. It must be a full page navigation, not fetch(): the user
// has to *see* Google's sign-in page.
async function googleLogin(): Promise<Response> {
  try {
    return redirect(await startLogin());
  } catch (error) {
    console.error("Could not start the login (is the provider reachable?):", error);
    return backToClient("provider_unavailable");
  }
}

// GET /auth/google/callback?code=…&state=… – the provider sends the user here.
async function googleCallback(req: BunRequest<"/auth/google/callback">): Promise<Response> {
  const url = new URL(req.url);

  // The user pressed "Cancel" on the consent screen, or the provider failed.
  if (url.searchParams.has("error")) {
    return backToClient("access_denied");
  }

  try {
    // Rebuild the URL on BASE_URL: behind a proxy or load balancer, req.url
    // may show an internal host name, but the token request must repeat the
    // redirect URI exactly as registered.
    const profile = await finishLogin(new URL(url.pathname + url.search, BASE_URL));
    const sessionId = createSession(profile);

    // req.cookies is Bun's cookie API (a CookieMap). Cookies set here are added
    // to the response as Set-Cookie headers automatically.
    req.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true, // invisible to JavaScript: an XSS bug cannot steal it
      secure: COOKIE_SECURE, // HTTPS only (in production)
      sameSite: "lax", // not sent with cross-site POSTs and iframes: CSRF protection
      path: "/",
      maxAge: SESSION_TTL_MS / 1000, // seconds
    });

    return redirect(`${FRONTEND_URL}/profile`);
  } catch (error) {
    // Invalid state, replayed callback, bad token… Log the details; tell the
    // user only that it failed.
    console.error("Login failed:", error);
    return backToClient("login_failed");
  }
}

// GET /api/me – the profile of the signed-in user.
function me(req: BunRequest<"/api/me">): Response {
  const sessionId = req.cookies.get(SESSION_COOKIE);
  const profile = sessionId ? getSession(sessionId) : null;
  if (!profile) return fail("Not authenticated", 401);
  return ok(profile);
}

// POST /auth/logout – end the session on the server and remove the cookie.
// POST, not GET: a GET could be triggered by any <img> on any website.
function logout(req: BunRequest<"/auth/logout">): Response {
  const sessionId = req.cookies.get(SESSION_COOKIE);
  if (sessionId) destroySession(sessionId);
  req.cookies.delete(SESSION_COOKIE, { path: "/" });
  return noContent();
}

export const routes = {
  "/auth/google/login": { GET: googleLogin },
  "/auth/google/callback": { GET: googleCallback },
  "/auth/logout": { POST: logout },
  "/api/me": { GET: me },
};

export function fallback(req: Request): Response {
  if (req.method === "OPTIONS") return noContent();
  return fail("Not found", 404);
}

export function errorHandler(error: Error): Response {
  console.error("Unhandled error:", error);
  return fail("Internal server error", 500);
}
