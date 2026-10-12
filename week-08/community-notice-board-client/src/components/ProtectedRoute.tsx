import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";

type Props = {
  children: ReactNode;
};

// Only for logged-in users. Because useAuth() re-renders this component when
// the token is cleared (logout, or a 401 from the API), the user is sent to the
// login page at that moment, wherever they are.
export default function ProtectedRoute({ children }: Readonly<Props>) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
