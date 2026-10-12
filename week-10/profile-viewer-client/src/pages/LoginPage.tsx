import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { LOGIN_URL } from "../api";
import PageShell from "../components/PageShell";

// The error codes the API may put in the URL after a failed login.
const ERROR_CODES = ["access_denied", "login_failed", "provider_unavailable"] as const;
type ErrorCode = (typeof ERROR_CODES)[number];

function isErrorCode(value: string | null): value is ErrorCode {
  return ERROR_CODES.includes(value as ErrorCode);
}

export default function LoginPage() {
  const { t } = useTranslation();
  // ?error=login_failed → a translated message. Unknown codes are ignored, so
  // nobody can put arbitrary text on the page through the URL.
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get("error");

  return (
    <PageShell>
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          {t("appTitle")}
        </Typography>

        <Box>
          <Typography variant="h5" component="h2" gutterBottom>
            {t("signIn.title")}
          </Typography>
          <Typography color="text.secondary">{t("signIn.description")}</Typography>
        </Box>

        {isErrorCode(errorCode) && <Alert severity="error">{t(`errors.${errorCode}`)}</Alert>}

        {/* A link, not a fetch: the browser leaves this app and goes to the
            API, then to Google, then back to /profile. */}
        <Button variant="contained" size="large" href={LOGIN_URL}>
          {t("signIn.button")}
        </Button>
      </Stack>
    </PageShell>
  );
}
