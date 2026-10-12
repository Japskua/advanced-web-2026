import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { Avatar, Button, Chip, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { UserProfile } from "@shared/types";
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
      <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography variant="h4" component="h1">
          {t("profile.title")}
        </Typography>

        <Avatar src={user.picture} alt={user.name} sx={{ width: 96, height: 96, fontSize: 40 }}>
          {user.name.charAt(0)}
        </Avatar>

        {/* Interpolation: {{name}} in the translation is replaced. */}
        <Typography variant="h5">{t("profile.welcome", { name: user.name })}</Typography>

        <Stack spacing={1} sx={{ width: "100%", textAlign: "left" }}>
          <Typography>
            <strong>{t("profile.email")}:</strong> {user.email}{" "}
            <Chip
              size="small"
              color={user.emailVerified ? "success" : "default"}
              label={user.emailVerified ? t("profile.verified") : t("profile.notVerified")}
            />
          </Typography>
          <Typography sx={{ wordBreak: "break-all" }}>
            <strong>{t("profile.userId")}:</strong> {user.sub}
          </Typography>
          <Typography>
            <strong>{t("profile.signedInAt")}:</strong> {signedInAt}
          </Typography>
        </Stack>

        <Button variant="outlined" color="secondary" onClick={handleLogout} disabled={loggingOut}>
          {t("profile.logout")}
        </Button>
      </Stack>
    </PageShell>
  );
}
