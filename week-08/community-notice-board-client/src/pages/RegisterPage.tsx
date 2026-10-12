import { useState, type SubmitEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router";
import { Alert, Box, Button, Link, Paper, Stack, TextField, Typography } from "@mui/material";
import { register } from "../api";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(email, password);
      navigate("/login", { state: { message: "Account created. You can now log in." } });
    } catch (err) {
      // The API explains exactly which password rules are not met.
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Paper sx={{ p: 4, maxWidth: 480, mx: "auto" }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Register
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2, mt: 2 }}>
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="At least 8 characters, with upper- and lowercase letters, a number and a special character."
          required
          fullWidth
        />

        {error && <Alert severity="error">{error}</Alert>}

        <Button type="submit" variant="contained" size="large" disabled={loading}>
          {loading ? "Registering…" : "Register"}
        </Button>

        <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
          <Typography variant="body2">Already registered?</Typography>
          <Link component={RouterLink} to="/login" variant="body2">
            Log in
          </Link>
        </Stack>
      </Box>
    </Paper>
  );
}
