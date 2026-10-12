import { useState, type SubmitEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { login } from "../api";
import { setToken } from "../auth";

// What other pages may pass to this one through navigation state.
type LocationState = { from?: string; message?: string } | null;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

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
      // Back to the page that sent the user here, or to the notes.
      navigate(state?.from ?? "/notes", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Login</h2>
      <p className="muted">Log in to read the secret notes.</p>

      {state?.message && <div className="success">{state.message}</div>}

      <form onSubmit={handleSubmit} className="form">
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <button className="button" type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>

      <p className="muted">
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
