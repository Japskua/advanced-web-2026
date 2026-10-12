import type { SavedJoke } from "@shared/types";

type Props = {
  jokes: SavedJoke[];
  loading: boolean;
  error: string;
};

export default function SavedJokesList({ jokes, loading, error }: Readonly<Props>) {
  return (
    <div className="card">
      <h2>Saved jokes</h2>

      {loading && <div className="muted">Loading saved jokes…</div>}
      {error && (
        <div className="errorBox" role="alert">
          Error: {error}
        </div>
      )}

      {!loading && !error && jokes.length === 0 && (
        <div className="muted">
          No saved jokes yet. Click <strong>Save</strong> to keep the current joke.
        </div>
      )}

      <ul className="list">
        {jokes.map((joke) => (
          <li key={joke.id} className="rowSaved">
            <div className="rowTop">
              {/* `savedAt` comes from the shared SavedJoke type. Upstream read
                  a field the API never sent and showed "Invalid Date". */}
              <span className="small">{new Date(joke.savedAt).toLocaleString()}</span>
              <span className="tag">{joke.category}</span>
            </div>
            <div className="savedText">{joke.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
