/**
 * The token store.
 *
 * Same idea as week 7 (the JWT lives in localStorage), with one addition:
 * every change is announced with an event, so React components can subscribe
 * and re-render when the user logs in or out (see hooks/useAuth.ts).
 */
import type { TokenClaims } from "@shared/types";

const TOKEN_KEY = "notice-board-token";
const AUTH_CHANGE_EVENT = "notice-board:auth-change";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

// Call `listener` whenever the token changes. The browser's own "storage" event
// fires when *another tab* changes localStorage, so logging out in one tab logs
// out the others too. Returns a function that unsubscribes.
export function subscribeToAuth(listener: () => void): () => void {
  window.addEventListener(AUTH_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Read the claims inside a JWT. The payload is Base64URL-encoded JSON, so the
 * client can read it, but it cannot check the signature (that needs the
 * server's secret). Use the claims only to adapt the UI, e.g. to show admin
 * links. The API checks the token and the role on every request anyway.
 */
export function decodeClaims(token: string): TokenClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;

    // Base64URL → Base64 → bytes → UTF-8 text → object
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TokenClaims;
  } catch {
    return null;
  }
}
