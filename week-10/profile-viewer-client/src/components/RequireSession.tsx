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
import { useTranslation } from "react-i18next";
import type { UserProfile } from "@shared/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
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
        <div className="mt-16 flex justify-center">
          <Spinner className="size-8 text-primary" aria-label={t("loading")} />
        </div>
      );
    case "signed-out":
      return <Navigate to="/" replace />;
    case "error":
      return (
        <div className="p-8">
          <Alert variant="destructive">
            <AlertDescription>{t("errors.server")}</AlertDescription>
          </Alert>
        </div>
      );
    case "signed-in":
      return <Outlet context={state.user} />;
  }
}
