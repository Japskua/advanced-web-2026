import { useState, type SubmitEvent } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router";
import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { login } from "../api";
import { setToken } from "../auth";

type LocationState = { from?: string; message?: string } | null;

export default function LoginPage() {
  const navigate = useNavigate();
  const state = useLocation().state as LocationState;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { token } = await login(email, password);
      setToken(token);
      navigate(state?.from ?? "/notifications", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper sx={{ p: 4, maxWidth: 480, mx: "auto" }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Login
      </Typography>

      {/* component="form" renders the Box as a <form> element. */}
      <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2, mt: 2 }}>
        {state?.message && <Alert severity="success">{state.message}</Alert>}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Button type="submit" variant="contained" size="large" disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </Button>

        <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
          <Typography variant="body2">No account?</Typography>
          <Link component={RouterLink} to="/register" variant="body2">
            Register
          </Link>
        </Stack>
      </Box>
    </Paper>
  );
}
