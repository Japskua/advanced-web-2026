/**
 * Client-side routing.
 *
 * The app has several "pages", but it is still one HTML page. React Router
 * looks at the URL, renders the matching <Route>, and changes the URL with the
 * History API when the user follows a <Link>. No page reload happens.
 *
 *   /           → redirect to /notes
 *   /login      → LoginPage       (public)
 *   /register   → RegisterPage    (public)
 *   /notes      → NotesPage       (protected: only for logged-in users)
 *   anything    → "Not found"
 */
import { Navigate, Route, Routes } from "react-router";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import NotesPage from "./pages/NotesPage";
import RegisterPage from "./pages/RegisterPage";

export default function App() {
  return (
    <>
      {/* Outside <Routes>, so it is shown on every page. */}
      <NavBar />

      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/notes" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <NotesPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<div className="card">Page not found.</div>} />
        </Routes>
      </main>
    </>
  );
}
