import Link from "next/link";

/** Matches a quoted series reference: "NAME".ts or "NAME".tsn */
const SERIES_REF_RE =
  /(["'])([%$\w]+(?:&[0-9Q]+[FH](?:\d+|F))?@\w+\.[ASQMWD])\1\.tsn?/gi;

interface LinkedExpressionProps {
  expression: string;
  universe: string;
  seriesLinks: Record<string, number>;
  seriesLastValues?: Record<string, number>;
  resultValue?: number | null;
  resultDate?: string | null;
  decimals?: number;
}

/** Split an expression into segments, identifying series references for linking. */
function tokenize(expression: string, seriesLinks: Record<string, number>) {
  const segments: { text: string; name?: string; id?: number }[] = [];
  let lastIndex = 0;

  for (const match of expression.matchAll(SERIES_REF_RE)) {
    const start = match.index!;
    if (start > lastIndex) {
      segments.push({ text: expression.slice(lastIndex, start) });
    }
    const name = match[2];
    segments.push({ text: match[0], name, id: seriesLinks[name] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < expression.length) {
    segments.push({ text: expression.slice(lastIndex) });
  }

  return segments;
}

export function LinkedExpression({
  expression,
  universe,
  seriesLinks,
  seriesLastValues = {},
  resultValue,
  resultDate,
  decimals = 1,
}: LinkedExpressionProps) {
  const segments = tokenize(expression, seriesLinks);
  const hasValues = Object.keys(seriesLastValues).length > 0;

  return (
    <div className="rounded-lg border bg-white p-4">
      {resultDate && (
        <p className="text-muted-foreground mb-2 text-xs">
          Calculation for {resultDate}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-1 font-mono text-sm">
        {segments.map((seg, i) => {
          if (seg.id != null && seg.name) {
            const lastValue = seriesLastValues[seg.name];

            if (hasValues) {
              return (
                <Link
                  key={i}
                  href={`/udaman/${universe}/series/${seg.id}`}
                  className="group inline-flex flex-col items-center rounded px-1 transition-colors hover:bg-blue-50"
                >
                  <span className="text-[10px] leading-tight text-blue-500 group-hover:text-blue-700">
                    {seg.name}
                  </span>
                  <span className="font-semibold text-blue-600 group-hover:text-blue-800">
                    {lastValue != null ? lastValue.toFixed(decimals) : "?"}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={i}
                href={`/udaman/${universe}/series/${seg.id}`}
                className="text-blue-600 underline hover:text-blue-800"
              >
                {seg.text}
              </Link>
            );
          }

          return <span key={i}>{seg.text}</span>;
        })}

        {hasValues && resultValue != null && (
          <>
            <span className="mx-1">=</span>
            <span className="font-semibold">
              {resultValue.toFixed(decimals)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
