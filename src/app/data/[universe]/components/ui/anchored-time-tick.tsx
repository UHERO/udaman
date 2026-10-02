import { AXIS_TICK } from "./chart-theme";

/**
 * Recharts <XAxis tick> for edgeTimeTicks: the first label anchors at its
 * start and the last at its end (so neither is clipped at the plot edge);
 * interior labels are centred.
 */
export function AnchoredTimeTick(props: {
  x?: number;
  y?: number;
  index?: number;
  visibleTicksCount?: number;
  payload?: { value: number };
  tickFormatter?: (value: number, index: number) => string;
}) {
  const { x = 0, y = 0, index = 0, visibleTicksCount = 1, payload } = props;
  if (!payload) return null;
  const anchor =
    visibleTicksCount < 2
      ? "middle"
      : index === 0
        ? "start"
        : index === visibleTicksCount - 1
          ? "end"
          : "middle";
  return (
    <text
      x={x}
      y={y}
      dy="0.71em"
      textAnchor={anchor}
      fontSize={AXIS_TICK.fontSize}
      fill={AXIS_TICK.fill}
    >
      {props.tickFormatter?.(payload.value, index) ?? payload.value}
    </text>
  );
}
