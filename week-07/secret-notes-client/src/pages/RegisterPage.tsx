import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { register } from "../api";

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    // Quick checks for a better experience. The API validates again.
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`The password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      // Navigation state: data passed to the next page without putting it in the URL.
      navigate("/login", { state: { message: "Account created. You can now log in." } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Register</h2>
      <p className="muted">Create an account to read the secret notes.</p>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className="hint">At least {MIN_PASSWORD_LENGTH} characters.</span>
        </label>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <button className="button" type="submit" disabled={loading}>
          {loading ? "Registering…" : "Register"}
        </button>
      </form>

      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
