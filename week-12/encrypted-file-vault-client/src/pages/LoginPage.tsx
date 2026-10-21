import { useState, type SubmitEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "../auth/useAuth";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { errorMessage } from "../format";

type LocationState = { from?: string; message?: string } | null;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const state = useLocation().state as LocationState;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      // The route guards send a user without a key to /onboarding.
      navigate(state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Login failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageLayout title="Encrypted File Vault" subtitle="Log in to your vault.">
      <form onSubmit={handleSubmit} className="grid gap-4">
        {state?.message && (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {/* A Label is tied to its Input with htmlFor/id, so clicking the label focuses the field. */}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-1 text-sm">
          No account?
          {/* `asChild` renders the Button as its child, a React Router <Link>: the link's look, client-side navigation. */}
          <Button variant="link" className="h-auto p-0" asChild>
            <Link to="/register">Register with an invitation code</Link>
          </Button>
        </div>
      </form>
    </AuthPageLayout>
  );
}
