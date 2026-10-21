import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import type { UserProfile } from "@shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logout } from "../api";
import PageShell from "../components/PageShell";

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Provided by RequireSession: this page only renders for signed-in users.
  const user = useOutletContext<UserProfile>();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  }

  // Dates and numbers are localised too, not only words: Intl formats them
  // the way the selected language expects ("12 Oct 2026" vs "12.10.2026").
  const signedInAt = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(user.signedInAt));

  return (
    <PageShell>
      <div className="grid justify-items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold">{t("profile.title")}</h1>

        {/* The picture, or the first letter of the name while it loads or if
            there is none. */}
        <Avatar className="size-24">
          <AvatarImage src={user.picture} alt={user.name} />
          <AvatarFallback className="text-4xl">{user.name.charAt(0)}</AvatarFallback>
        </Avatar>

        {/* Interpolation: {{name}} in the translation is replaced. */}
        <h2 className="text-xl">{t("profile.welcome", { name: user.name })}</h2>

        <div className="grid w-full gap-2 text-left">
          <p>
            <strong>{t("profile.email")}:</strong> {user.email}{" "}
            {/* The Badge has no green "success" variant: Tailwind classes in
                className add one (they win over the component's own). */}
            <Badge
              variant="outline"
              className={user.emailVerified ? "border-transparent bg-green-700 text-white" : undefined}
            >
              {user.emailVerified ? t("profile.verified") : t("profile.notVerified")}
            </Badge>
          </p>
          <p className="break-all">
            <strong>{t("profile.userId")}:</strong> {user.sub}
          </p>
          <p>
            <strong>{t("profile.signedInAt")}:</strong> {signedInAt}
          </p>
        </div>

        <Button
          variant="outline"
          className="border-secondary text-secondary hover:bg-secondary/10 hover:text-secondary"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {t("profile.logout")}
        </Button>
      </div>
    </PageShell>
  );
}
