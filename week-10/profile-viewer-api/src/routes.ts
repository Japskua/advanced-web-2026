/**
 * The routes: the OAuth 2.0 / OpenID Connect sign-in and the session.
 *
 *   GET  /auth/google/login      start the sign-in (redirect to the provider)
 *   GET  /auth/google/callback   the provider sends the user back here
 *   POST /auth/logout            end the session
 *   GET  /api/me                 the signed-in user's profile
 *
 * Elysia gives each handler the request's cookies as `cookie`: one object per
 * cookie name, with `.value` to read it, `.set({...})` to send it to the
 * browser and `.remove()` to delete it. The Set-Cookie headers are added to
 * the response automatically, redirects included. The `cookie` schema below
 * declares the one cookie this API uses, so `session` is always there (its
 * `.value` is a string or undefined).
 */
import { Elysia, t } from "elysia";
import { BASE_URL, COOKIE_SECURE, FRONTEND_URL, SESSION_TTL_MS } from "./config";
import { finishLogin, startLogin } from "./services/login-service";
import { createSession, destroySession, getSession } from "./services/session-service";
import { fail, ok } from "./util/response";

// Errors are reported to the client with a short code in the URL
// (/?error=login_failed); the client translates the code into a message.
type LoginErrorCode = "access_denied" | "login_failed" | "provider_unavailable";

function backToClient(error: LoginErrorCode): string {
  return `${FRONTEND_URL}/?error=${error}`;
}

const sessionCookie = t.Cookie({ session: t.Optional(t.String()) });

export const routes = new Elysia()
  .guard({ cookie: sessionCookie })

  // GET /auth/google/login – the client's "Sign in with Google" button is a
  // plain link to this URL. It must be a full page navigation, not fetch():
  // the user has to *see* Google's sign-in page.
  .get("/auth/google/login", async ({ redirect }) => {
    try {
      return redirect(String(await startLogin()), 302);
    } catch (error) {
      console.error("Could not start the login (is the provider reachable?):", error);
      return redirect(backToClient("provider_unavailable"), 302);
    }
  })

  // GET /auth/google/callback?code=…&state=… – the provider sends the user here.
  .get("/auth/google/callback", async ({ request, cookie: { session }, redirect }) => {
    const url = new URL(request.url);

    // The user pressed "Cancel" on the consent screen, or the provider failed.
    if (url.searchParams.has("error")) {
      return redirect(backToClient("access_denied"), 302);
    }

    try {
      // Rebuild the URL on BASE_URL: behind a proxy or load balancer,
      // request.url may show an internal host name, but the token request
      // must repeat the redirect URI exactly as registered.
      const profile = await finishLogin(new URL(url.pathname + url.search, BASE_URL));
      const sessionId = createSession(profile);

      session.set({
        value: sessionId,
        httpOnly: true, // invisible to JavaScript: an XSS bug cannot steal it
        secure: COOKIE_SECURE, // HTTPS only (in production)
        sameSite: "lax", // not sent with cross-site POSTs and iframes: CSRF protection
        path: "/",
        maxAge: SESSION_TTL_MS / 1000, // seconds
      });

      return redirect(`${FRONTEND_URL}/profile`, 302);
    } catch (error) {
      // Invalid state, replayed callback, bad token… Log the details; tell
      // the user only that it failed.
      console.error("Login failed:", error);
      return redirect(backToClient("login_failed"), 302);
    }
  })

  // GET /api/me – the profile of the signed-in user.
  .get("/api/me", ({ cookie: { session }, status }) => {
    const profile = session.value ? getSession(session.value) : null;
    if (!profile) return status(401, fail("Not authenticated"));
    return ok(profile);
  })

  // POST /auth/logout – end the session on the server and remove the cookie.
  // POST, not GET: a GET could be triggered by any <img> on any website.
  .post("/auth/logout", ({ cookie: { session }, status }) => {
    if (session.value) destroySession(session.value);
    session.remove();
    return status(204);
  });
