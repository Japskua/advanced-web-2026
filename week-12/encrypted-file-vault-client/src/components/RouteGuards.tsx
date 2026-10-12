/**
 * Route guards. Each page belongs to exactly one state of the user:
 *
 *   anonymous                          → /login, /register        (PublicOnlyRoute)
 *   logged in, no key set up yet       → /onboarding              (OnboardingRoute)
 *   logged in, key set up              → /  (the dashboard)       (ProtectedRoute)
 *
 * A user in the wrong state is redirected to the right page, so, for example,
 * nobody can reach the dashboard before creating an encryption key.
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "../auth/useAuth";

function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}

export function ProtectedRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === "loading") return <FullPageSpinner />;
  if (state.status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!state.user.keyFingerprint) return <Navigate to="/onboarding" replace />;
  return children;
}

export function OnboardingRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { state } = useAuth();

  if (state.status === "loading") return <FullPageSpinner />;
  if (state.status === "anonymous") return <Navigate to="/login" replace />;
  if (state.user.keyFingerprint) return <Navigate to="/" replace />;
  return children;
}

export function PublicOnlyRoute({ children }: Readonly<{ children: ReactNode }>) {
  const { state } = useAuth();

  if (state.status === "loading") return <FullPageSpinner />;
  if (state.status === "authenticated") {
    return <Navigate to={state.user.keyFingerprint ? "/" : "/onboarding"} replace />;
  }
  return children;
}
