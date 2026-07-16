/**
 * Status bar: whose turn it is and the most recent event string.
 *
 * Event copy is produced by the caller (App) from engine results; this
 * component only displays it.
 */

interface StatusBarProps {
  readonly turnLabel: string;
  readonly event: string;
}

export function StatusBar({ turnLabel, event }: StatusBarProps) {
  return (
    <div className="status-bar" role="status" aria-live="polite">
      <span className="status-turn">{turnLabel}</span>
      <span className="status-event">{event}</span>
    </div>
  );
}
