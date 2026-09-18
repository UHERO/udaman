"use client";

import { useId, useMemo } from "react";

/**
 * US GDP (trillions, current USD) 2000–2024
 * Source: BEA / World Bank
 */
const US_GDP = [
  10.25, 10.58, 10.94, 11.46, 12.21, 13.04, 13.81, 14.45, 14.71, 14.45, 15.05,
  15.6, 16.25, 16.88, 17.62, 18.24, 18.75, 19.61, 20.58, 21.43, 21.06, 23.32,
  25.46, 27.36, 28.78,
];

function gdpToPoints(
  data: number[],
  width: number,
  height: number,
  pad: number,
) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const xStep = (width - pad * 2) / (data.length - 1);
  return data
    .map((v, i) => {
      const x = pad + i * xStep;
      const y = height - pad - ((v - min) / (max - min)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function GdpLineChart() {
  const id = useId();
  const w = 120;
  const h = 48;
  const pad = 4;

  const points = useMemo(() => gdpToPoints(US_GDP, w, h, pad), []);

  // We need the approximate path length for the dash animation.
  // For a polyline through 25 points across 120px wide, ~160 is a safe upper bound.
  const pathLen = 200;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        fill="none"
        className="overflow-visible"
        role="img"
        aria-label="Loading"
      >
        {/* faint axis lines */}
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          className="stroke-muted-foreground/30"
          strokeWidth={0.5}
        />
        <line
          x1={pad}
          y1={pad}
          x2={pad}
          y2={h - pad}
          className="stroke-muted-foreground/30"
          strokeWidth={0.5}
        />

        {/* static faint trail */}
        <polyline
          points={points}
          className="stroke-muted-foreground/15"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* animated line */}
        <polyline
          points={points}
          className="stroke-primary"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={pathLen}
          strokeDashoffset={pathLen}
          style={{
            animation: `loader-draw-${id.replace(/:/g, "")} 2s ease-in-out infinite`,
          }}
        />

        <style>{`
          @keyframes loader-draw-${id.replace(/:/g, "")} {
            0% { stroke-dashoffset: ${pathLen}; opacity: 0.3; }
            10% { opacity: 1; }
            60% { stroke-dashoffset: 0; opacity: 1; }
            80% { stroke-dashoffset: 0; opacity: 1; }
            100% { stroke-dashoffset: 0; opacity: 0; }
          }
        `}</style>
      </svg>
      <span className="text-muted-foreground text-xs">Loading...</span>
    </div>
  );
}

const LOADERS = [GdpLineChart];

export function Loader() {
  const Component = useMemo(() => {
    return LOADERS[Math.floor(Math.random() * LOADERS.length)];
  }, []);

  return <Component />;
}
