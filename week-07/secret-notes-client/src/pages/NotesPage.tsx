import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Note } from "@shared/types";
import { ApiError, fetchNotes } from "../api";
import { clearToken } from "../auth";

export default function NotesPage() {
  const navigate = useNavigate();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetchNotes(controller.signal)
      .then(setNotes)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        // 401: the token is missing, expired or invalid. Forget it and ask the
        // user to log in again.
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          navigate("/login", { replace: true, state: { from: "/notes", message: "Please log in again." } });
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load notes");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // `navigate` is used inside the effect, so it is listed as a dependency.
    // It is stable (the same function on every render), so the effect still
    // runs only once.
  }, [navigate]);

  return (
    <div className="card">
      <h2>Secret Notes</h2>
      <p className="muted">Only authenticated users can see these.</p>

      {loading && <div className="muted">Loading…</div>}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && (
        <ul className="notes">
          {notes.map((note) => (
            <li key={note.id} className="noteItem">
              {note.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
