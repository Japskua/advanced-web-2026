/**
 * useAuth(): the current login state, as a hook.
 *
 * The token lives outside React (in localStorage). useSyncExternalStore is the
 * React hook for reading such an "external store": React calls `getToken` to
 * read the current value and re-renders the component whenever the store
 * announces a change through `subscribeToAuth`.
 *
 * So after setToken() or clearToken(), every component that uses this hook
 * (the app bar, the route guards) updates at once. Week 7 needed a trick with
 * useLocation() for that; week 12 moves auth state into a React context.
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Role } from "@shared/types";
import { decodeClaims, getToken, subscribeToAuth } from "../auth";

export interface AuthState {
  isLoggedIn: boolean;
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
  role: Role | null;
}

export function useAuth(): AuthState {
  const token = useSyncExternalStore(subscribeToAuth, getToken);

  // Decoding is cheap, but there is no reason to repeat it on every render.
  return useMemo(() => {
    const claims = token ? decodeClaims(token) : null;
    return {
      isLoggedIn: claims !== null,
      isAdmin: claims?.role === "admin",
      userId: claims?.sub ?? null,
      email: claims?.email ?? null,
      role: claims?.role ?? null,
    };
  }, [token]);
}
