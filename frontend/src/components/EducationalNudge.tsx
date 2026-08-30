type Props = {
  title: string;
  message: string;
  nextLabel?: string;
  nextAction?: () => void;
  onDismiss?: () => void;
  type?: "info" | "success" | "warning";
};

export function EducationalNudge({ title, message, nextLabel, nextAction, onDismiss, type = "info" }: Props) {
  return (
    <div className={`nudge ${type}`}>
      <div className="nudge-body">
        <div className="nudge-title">{title}</div>
        <div className="nudge-msg">{message}</div>
        {nextLabel && nextAction && (
          <button type="button" className="primary" onClick={nextAction}>
            {nextLabel}
          </button>
        )}
      </div>
      {onDismiss && (
        <button type="button" className="nudge-x" onClick={onDismiss} aria-label="Dismiss">
          x
        </button>
      )}
    </div>
  );
}
