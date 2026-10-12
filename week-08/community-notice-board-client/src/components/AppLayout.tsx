import type { ReactNode } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import { AppBar, Box, Button, Chip, Container, Toolbar, Typography } from "@mui/material";
import { clearToken } from "../auth";
import { useAuth } from "../hooks/useAuth";

type Props = {
  children: ReactNode;
};

/**
 * The frame around every page: an app bar with role-aware navigation.
 *
 * MUI components are configured with props (variant, color, …) and styled with
 * the `sx` prop, which takes CSS properties plus theme shortcuts: `p: 3` is
 * padding of 3 spacing units (24px), `mx: "auto"` centres horizontally.
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
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="static">
        <Toolbar sx={{ gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Community Notice Board
          </Typography>

          {isLoggedIn && (
            // `component={RouterLink}` renders the MUI Button as a React Router
            // <Link>: MUI's look, client-side navigation.
            <Button color="inherit" component={RouterLink} to="/notifications">
              Notifications
            </Button>
          )}

          {isAdmin && (
            <>
              <Button color="inherit" component={RouterLink} to="/admin/notifications/new">
                New notification
              </Button>
              <Button color="inherit" component={RouterLink} to="/admin/users">
                Users
              </Button>
            </>
          )}

          {isLoggedIn ? (
            <>
              <Chip
                label={isAdmin ? `${email} · admin` : email}
                size="small"
                sx={{ color: "inherit", borderColor: "rgba(255,255,255,0.5)" }}
                variant="outlined"
              />
              <Button color="inherit" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/login">
                Login
              </Button>
              <Button color="inherit" component={RouterLink} to="/register">
                Register
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {children}
      </Container>
    </Box>
  );
}
