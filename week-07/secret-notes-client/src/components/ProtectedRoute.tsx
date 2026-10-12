import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { isLoggedIn } from "../auth";

type Props = {
  children: ReactNode;
};

/**
 * Renders its children only for logged-in users; everyone else is redirected
 * to /login. The current location is passed along in the navigation state, so
 * the login page can send the user back here afterwards.
 *
 * Remember that this is user experience, not security: anyone can edit the
 * JavaScript in their browser. The real protection is the API answering 401
 * without a valid token.
 */
export default function ProtectedRoute({ children }: Readonly<Props>) {
  const location = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
