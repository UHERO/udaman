import { PRIMARY } from "../lib/theme";

/**
 * Row sparkline (old data_table sparklines): level over the main chart's
 * date window, own y-scale, line + faint area, dot on the last value.
 * Gaps (nulls) break the line.
 */
export function Sparkline({
  values,
  width = 112,
  height = 30,
  color = PRIMARY,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = 2;
  const x = (i: number) =>
    pad + (i / Math.max(1, values.length - 1)) * (width - 2 * pad);
  const y = (v: number) =>
    max === min
      ? height / 2
      : pad + (1 - (v - min) / (max - min)) * (height - 2 * pad);

  // Contiguous runs of non-null values → one path segment each.
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push([x(i), y(v)]);
  });
  if (run.length) runs.push(run);

  const line = runs
    .map((r) => r.map(([px, py], k) => `${k ? "L" : "M"}${px},${py}`).join(""))
    .join("");
  const area = runs
    .filter((r) => r.length > 1)
    .map(
      (r) =>
        `M${r[0][0]},${height}` +
        r.map(([px, py]) => `L${px},${py}`).join("") +
        `L${r[r.length - 1][0]},${height}Z`,
    )
    .join("");
  const lastRun = runs[runs.length - 1];
  const [lx, ly] = lastRun[lastRun.length - 1];

  return (
    <svg width={width} height={height} aria-hidden className="block">
      <path d={area} fill={color} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.25} />
      <circle cx={lx} cy={ly} r={1.75} fill={color} />
    </svg>
  );
}
