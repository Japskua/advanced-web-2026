import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../hooks/useAuth";

type Props = {
  children: ReactNode;
};

// Only for administrators: anonymous users go to the login page, logged-in
// non-admins to the notifications.
export default function AdminRoute({ children }: Readonly<Props>) {
  const { isLoggedIn, isAdmin } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAdmin) {
    return <Navigate to="/notifications" replace />;
  }
  return children;
}
