/**
 * Pseudo-history line styling. A chart draws the level twice: dashed over
 * every point, then solid on top, clipped to the x-ranges around real
 * points. Each segment between a real and a pseudo point switches style at
 * its midpoint, so sparse real data (census years between interpolated
 * ones, or alternating real/pseudo years) reads as solid near the real
 * points and dashed near the pseudo ones, on one smooth curve.
 */

type ScaleFn = (v: number) => number;

/**
 * [startTs, endTs] ranges drawn solid: each run of real points, out to the
 * midpoints toward its pseudo neighbours (open-ended at the data's ends).
 */
export function realRanges(
  points: readonly { ts: number; pseudo?: boolean }[],
): [number, number][] {
  const ranges: [number, number][] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    if (points[i].pseudo) continue;
    let j = i;
    while (j + 1 < n && !points[j + 1].pseudo) j++;
    const start =
      i > 0 ? (points[i - 1].ts + points[i].ts) / 2 : Number.NEGATIVE_INFINITY;
    const end =
      j < n - 1
        ? (points[j].ts + points[j + 1].ts) / 2
        : Number.POSITIVE_INFINITY;
    ranges.push([start, end]);
    i = j;
  }
  return ranges;
}

/** Class that clips a Line/Area to the clip path with this id. */
export function pseudoClipClass(id: string): string {
  return `pseudo-clip-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/**
 * Clip path for the solid line, rendered via recharts `<Customized
 * component={<PseudoClip … />} />` (recharts injects xAxisMap). Recharts
 * drops a `clipPath` prop on Line, but keeps `className`, so the clip is
 * applied by a CSS rule on `pseudoClipClass(id)`.
 */
export function PseudoClip({
  id,
  ranges,
  xAxisId = 0,
  xAxisMap,
}: {
  id: string;
  ranges: [number, number][];
  xAxisId?: string | number;
  /** Injected by recharts' Customized. */
  xAxisMap?: Record<string, { scale?: ScaleFn }>;
}) {
  const scale = xAxisMap?.[xAxisId]?.scale;
  if (!scale) return null;
  const cls = pseudoClipClass(id);
  const clipId = `${cls}-path`;
  const BIG = 1e5;
  const x = (ts: number) =>
    Number.isFinite(ts) ? scale(ts) : ts < 0 ? -BIG : BIG;
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          {ranges.map(([a, b]) => {
            const x0 = x(a);
            const x1 = x(b);
            return (
              <rect
                key={a}
                x={x0}
                y={-BIG}
                width={Math.max(0, x1 - x0)}
                height={2 * BIG}
              />
            );
          })}
        </clipPath>
      </defs>
      <style>{`.${cls}{clip-path:url(#${clipId})}`}</style>
    </>
  );
}
