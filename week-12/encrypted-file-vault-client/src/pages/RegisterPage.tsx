import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "../api";
import { AuthPageLayout } from "../components/AuthPageLayout";
import { errorMessage } from "../format";

export function RegisterPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register({ email, password, inviteCode });
      navigate("/login", { replace: true, state: { message: "Account created. Log in to set up your key." } });
    } catch (err) {
      setError(errorMessage(err, "Registration failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPageLayout title="Register" subtitle="Create an account with the course invitation code.">
      <form onSubmit={handleSubmit} className="grid gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-describedby="password-help"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p id="password-help" className="text-sm text-muted-foreground">
            At least 8 characters, with upper- and lowercase letters, a number and a special character.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-code">Invitation code</Label>
          <Input id="invite-code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Creating account…" : "Register"}
        </Button>
        <div className="flex flex-wrap items-center justify-center gap-1 text-sm">
          Already registered?
          <Button variant="link" className="h-auto p-0" asChild>
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      </form>
    </AuthPageLayout>
  );
}
