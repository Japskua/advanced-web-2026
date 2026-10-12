/**
 * Storing the JWT in the browser.
 *
 * localStorage keeps the token across page reloads and browser restarts, so
 * the user stays logged in until the token expires (2 hours) or they log out.
 *
 * The trade-off: any JavaScript running on the page can read localStorage. If
 * an attacker manages to inject a script (XSS), they can steal the token. Week
 * 10 shows the alternative: a session cookie marked HttpOnly, which scripts
 * cannot read at all.
 */

const TOKEN_KEY = "secret-notes-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Having a token does not prove it is still valid: it may have expired. The
// server has the final word; a 401 from the API logs the user out.
export function isLoggedIn(): boolean {
  return getToken() !== null;
}
