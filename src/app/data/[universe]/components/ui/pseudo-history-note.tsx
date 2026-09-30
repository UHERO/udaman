/** Dash pattern for pseudo-history segments (shared so the key matches). */
export const PSEUDO_DASH = "4 3";

/**
 * Legend note shown next to a chart's axis label only when pseudo history
 * is in view: a dashed swatch + "Pseudo history" (hover for the meaning).
 */
export function PseudoHistoryNote({ color }: { color: string }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1.5"
      title="Pseudo history: values estimated by UHERO outside the source data (dashed)"
    >
      <svg aria-hidden width="16" height="4" className="shrink-0">
        <line
          x1="0"
          y1="2"
          x2="16"
          y2="2"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray={PSEUDO_DASH}
        />
      </svg>
      Pseudo history
    </span>
  );
}
