/**
 * The authentication context.
 *
 * Context passes a value to every component below a provider without
 * threading it through props. The AuthProvider owns the login state; any
 * component can read it with useAuth().
 *
 * Week 7 read the token from localStorage in each component; week 8 subscribed
 * to localStorage with useSyncExternalStore. Here the state lives in React, the
 * current user comes from the server (GET /api/auth/me), and the context
 * offers actions (login, logout) as well as data.
 */
import { createContext } from "react";
import type { UserDto } from "@shared/types";

export type AuthState =
  | { status: "loading" } // a token exists; asking the server who it belongs to
  | { status: "anonymous" }
  | { status: "authenticated"; user: UserDto };

export interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  // Replace the stored user, e.g. after onboarding set the key fingerprint.
  setUser: (user: UserDto) => void;
}

// undefined = "no provider above this component" (a programming error).
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
