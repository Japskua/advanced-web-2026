// A purely presentational component: it receives numbers and draws them.
// Values derived from props (here: the percentage) are plain calculations in
// the component body, not state.
interface ProgressBarProps {
  completed: number;
  total: number;
}

export default function ProgressBar({ completed, total }: Readonly<ProgressBarProps>) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="progressWrap">
      <div
        className="progressBar"
        role="progressbar"
        aria-label="Habits completed"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Inline styles are objects in JSX: style={{ width: "40%" }} */}
        <div className="progressFill" style={{ width: `${percentage}%` }} />
        <div className="progressText">{percentage}%</div>
      </div>
      <div className="progressMeta">
        Completed: {completed} / {total}
      </div>
    </div>
  );
}
