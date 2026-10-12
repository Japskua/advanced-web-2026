type Props = {
  refreshSeconds: number;
  loadingJoke: boolean;
  onNewJoke: () => void;
  canSave: boolean;
  isSaved: boolean;
  onSave: () => void;
};

export default function Header({ refreshSeconds, loadingJoke, onNewJoke, canSave, isSaved, onSave }: Readonly<Props>) {
  return (
    <header className="header">
      <div>
        <h1>Joke Dashboard</h1>
        <p className="sub">A new joke every {refreshSeconds} seconds, or whenever you ask for one.</p>
      </div>

      <div className="headerActions">
        <button className="btn" onClick={onNewJoke} disabled={loadingJoke}>
          New joke
        </button>
        <button className="btn" onClick={onSave} disabled={!canSave}>
          {isSaved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </header>
  );
}
