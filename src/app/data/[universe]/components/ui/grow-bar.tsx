/**
 * Recharts <Bar shape> that grows out of the zero line on mount via CSS
 * (keyframes `portal-bar-grow` in globals.css). Replaces Recharts' own bar
 * animation, which could stall at zero height on long, 1px-bar timelines
 * until a re-render (e.g. hover) drew the bars statically.
 *
 * Recharts passes y = value's pixel and height = zeroPixel - y, so the zero
 * baseline is always y + height (height is negative for negative values).
 * Re-key the <Bar> to replay the animation (e.g. on YOY ↔ YTD).
 */
export function GrowBar(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  fillOpacity?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, fill, fillOpacity } = props;
  if (!width || !height) return null;
  const baseline = y + height;
  return (
    <rect
      x={x}
      y={Math.min(y, baseline)}
      width={width}
      height={Math.abs(height)}
      fill={fill}
      fillOpacity={fillOpacity}
      style={{
        transformBox: "view-box",
        transformOrigin: `0 ${baseline}px`,
        animation: "portal-bar-grow 450ms ease-out both",
      }}
    />
  );
}
