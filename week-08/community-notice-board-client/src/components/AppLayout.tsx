import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearToken } from "../auth";
import { useAuth } from "../hooks/useAuth";

type Props = {
  children: ReactNode;
};

// Ghost buttons hover with a light grey by default; on the blue header a
// translucent white looks better. Tailwind classes in `className` override the
// component's own.
const headerButton = "hover:bg-primary-foreground/15 hover:text-primary-foreground";

/**
 * The frame around every page: a header bar with role-aware navigation.
 *
 * shadcn/ui components are configured with props (variant, size) and styled
 * with Tailwind classes in `className`: `px-4` is horizontal padding of 4
 * spacing units (16px), `mx-auto` centres horizontally, `gap-2` puts 8px
 * between flex items.
 *
 * Hiding the admin links from normal users is only for convenience. The API
 * answers 403 to a non-admin no matter what the UI shows.
 */
export default function AppLayout({ children }: Readonly<Props>) {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, email } = useAuth();

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="bg-primary text-primary-foreground shadow">
        <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="grow text-lg font-semibold">Community Notice Board</span>

          {isLoggedIn && (
            // `asChild` renders the Button as its child, a React Router <Link>:
            // the button's look, client-side navigation.
            <Button variant="ghost" className={headerButton} asChild>
              <Link to="/notifications">Notifications</Link>
            </Button>
          )}

          {isAdmin && (
            <>
              <Button variant="ghost" className={headerButton} asChild>
                <Link to="/admin/notifications/new">New notification</Link>
              </Button>
              <Button variant="ghost" className={headerButton} asChild>
                <Link to="/admin/users">Users</Link>
              </Button>
            </>
          )}

          {isLoggedIn ? (
            <>
              <Badge variant="outline" className="border-primary-foreground/50 text-primary-foreground">
                {isAdmin ? `${email} · admin` : email}
              </Badge>
              <Button variant="ghost" className={headerButton} onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className={headerButton} asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button variant="ghost" className={headerButton} asChild>
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
