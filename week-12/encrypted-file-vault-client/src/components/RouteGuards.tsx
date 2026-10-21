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
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "../auth/useAuth";

// The Spinner has role="status" and aria-label="Loading" for screen readers.
function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner className="size-8 text-primary" />
    </div>
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
