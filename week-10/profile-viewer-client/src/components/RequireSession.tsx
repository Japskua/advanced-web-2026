/**
 * A *layout route* that guards its child routes.
 *
 * With a session cookie, the client cannot know by itself whether the user is
 * signed in: the cookie is HttpOnly, so JavaScript cannot even see it. The only
 * way to find out is to ask the API (GET /api/me).
 *
 * This component asks once, then renders the matching child route through
 * <Outlet>, handing it the profile via the outlet context. Child pages read it
 * with useOutletContext() instead of fetching it again.
 */
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import { Alert, Box, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { UserProfile } from "@shared/types";
import { ApiError, fetchMe } from "../api";

type SessionState =
  | { status: "loading" }
  | { status: "signed-in"; user: UserProfile }
  | { status: "signed-out" }
  | { status: "error" };

export default function RequireSession() {
  const { t } = useTranslation();
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetchMe(controller.signal)
      .then((user) => setState({ status: "signed-in", user }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // 401 means "no session"; anything else means we could not tell.
        const signedOut = error instanceof ApiError && error.status === 401;
        setState({ status: signedOut ? "signed-out" : "error" });
      });

    return () => controller.abort();
  }, []);

  switch (state.status) {
    case "loading":
      return (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
          <CircularProgress aria-label={t("loading")} />
        </Box>
      );
    case "signed-out":
      return <Navigate to="/" replace />;
    case "error":
      return (
        <Alert severity="error" sx={{ m: 4 }}>
          {t("errors.server")}
        </Alert>
      );
    case "signed-in":
      return <Outlet context={state.user} />;
  }
}
