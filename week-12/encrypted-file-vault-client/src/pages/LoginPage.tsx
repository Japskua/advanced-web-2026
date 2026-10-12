import { useState, type SubmitEvent } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router";
import { Alert, Box, Button, Link, Stack, TextField, Typography } from "@mui/material";
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
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          {state?.message && <Alert severity="success">{state.message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </Button>
          <Typography variant="body2" sx={{ textAlign: "center" }}>
            No account?{" "}
            <Link component={RouterLink} to="/register">
              Register with an invitation code
            </Link>
          </Typography>
        </Stack>
      </Box>
    </AuthPageLayout>
  );
}
