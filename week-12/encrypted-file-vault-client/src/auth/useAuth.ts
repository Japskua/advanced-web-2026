import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./AuthContext";

// A custom hook around useContext: callers get a non-undefined value, and
// forgetting the provider fails loudly instead of silently returning undefined.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth() must be used inside <AuthProvider>.");
  return context;
}
