import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
      <div className="grid gap-6">
        <h1 className="text-3xl font-semibold">{t("appTitle")}</h1>

        <div className="grid gap-2">
          <h2 className="text-xl font-semibold">{t("signIn.title")}</h2>
          <p className="text-muted-foreground">{t("signIn.description")}</p>
        </div>

        {isErrorCode(errorCode) && (
          <Alert variant="destructive">
            <AlertDescription>{t(`errors.${errorCode}`)}</AlertDescription>
          </Alert>
        )}

        {/* A link, not a fetch: the browser leaves this app and goes to the
            API, then to Google, then back to /profile. `asChild` renders the
            Button as its child, a plain <a>: the button's look, a real link. */}
        <Button size="lg" asChild>
          <a href={LOGIN_URL}>{t("signIn.button")}</a>
        </Button>
      </div>
    </PageShell>
  );
}
