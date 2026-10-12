import { useState, type SubmitEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import { Alert, Box, Button, Link, Stack, TextField, Typography } from "@mui/material";
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
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText="At least 8 characters, with upper- and lowercase letters, a number and a special character."
            required
            fullWidth
          />
          <TextField label="Invitation code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required fullWidth />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? "Creating account…" : "Register"}
          </Button>
          <Typography variant="body2" sx={{ textAlign: "center" }}>
            Already registered?{" "}
            <Link component={RouterLink} to="/login">
              Log in
            </Link>
          </Typography>
        </Stack>
      </Box>
    </AuthPageLayout>
  );
}
