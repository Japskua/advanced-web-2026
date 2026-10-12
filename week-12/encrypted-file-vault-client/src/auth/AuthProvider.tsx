import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UserDto } from "@shared/types";
import { fetchMe, login as loginRequest, setUnauthorizedHandler, tokenStore } from "../api";
import { AuthContext, type AuthContextValue, type AuthState } from "./AuthContext";

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  // The initial state is decided synchronously: with a stored token we must
  // ask the server, without one we already know the answer.
  const [state, setState] = useState<AuthState>(() =>
    tokenStore.get() ? { status: "loading" } : { status: "anonymous" },
  );

  // On startup, turn a stored token into a user (or discover it has expired).
  useEffect(() => {
    if (!tokenStore.get()) return;
    const controller = new AbortController();

    fetchMe(controller.signal)
      .then((user) => setState({ status: "authenticated", user }))
      .catch(() => {
        if (controller.signal.aborted) return;
        tokenStore.clear();
        setState({ status: "anonymous" });
      });

    return () => controller.abort();
  }, []);

  // useCallback keeps these functions stable, so the context value below only
  // changes when the state changes (and consumers only re-render then).
  const logout = useCallback(() => {
    tokenStore.clear();
    setState({ status: "anonymous" });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await loginRequest(email, password);
    tokenStore.set(token);
    setState({ status: "authenticated", user });
  }, []);

  const setUser = useCallback((user: UserDto) => setState({ status: "authenticated", user }), []);

  // Any 401 from the API (an expired token) logs the user out everywhere.
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  const value = useMemo<AuthContextValue>(() => ({ state, login, logout, setUser }), [state, login, logout, setUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
