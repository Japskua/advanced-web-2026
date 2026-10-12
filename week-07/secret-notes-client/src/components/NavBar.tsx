import { Link, useLocation, useNavigate } from "react-router";
import { clearToken, isLoggedIn } from "../auth";

export default function NavBar() {
  const navigate = useNavigate();

  // The login state lives in localStorage, which React does not watch. Reading
  // the current location makes NavBar re-render on every navigation (for
  // example the redirect after login), so isLoggedIn() is evaluated again.
  // Week 8 replaces this trick with useSyncExternalStore, week 12 with a React context.
  useLocation();
  const loggedIn = isLoggedIn();

  function logout() {
    clearToken();
    navigate("/login");
  }

  return (
    <nav className="nav">
      {/* <Link> changes the URL without reloading the page; a plain <a href>
          would download the whole app again. */}
      <Link to="/" className="brand">
        Secret Notes
      </Link>

      <div className="navLinks">
        <Link to="/notes">Notes</Link>
        {!loggedIn && <Link to="/register">Register</Link>}
        {!loggedIn && <Link to="/login">Login</Link>}
        {loggedIn && (
          <button className="linkButton" onClick={logout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
