import Link from "next/link";

const NAME_REGEX = /^([%$\w]+?(&[0-9Q]+[FH]\d+F?)?)@\w+?(\.[ASQMWD])?$/i;

interface LinkedExpressionProps {
  expression: string;
  universe: string;
  seriesLinks: Record<string, number>;
  seriesLastValues?: Record<string, number>;
  resultValue?: number | null;
  decimals?: number;
}

export function LinkedExpression({
  expression,
  universe,
  seriesLinks,
  seriesLastValues = {},
  resultValue,
  decimals = 1,
}: LinkedExpressionProps) {
  const tokens = expression.split(/(\s+|[+*\/()-])/).filter(Boolean);
  const hasValues = Object.keys(seriesLastValues).length > 0;

  return (
    <div className="flex flex-wrap items-end gap-1 rounded-lg border bg-white p-4 font-mono text-sm">
      {tokens.map((token, i) => {
        const id = seriesLinks[token];
        const isSeriesName = id != null && NAME_REGEX.test(token);
        const lastValue = seriesLastValues[token];

        if (isSeriesName && hasValues) {
          return (
            <Link
              key={i}
              href={`/udaman/${universe}/series/${id}`}
              className="group inline-flex flex-col items-center hover:bg-blue-50 rounded px-1 transition-colors"
            >
              <span className="text-[10px] leading-tight text-blue-500 group-hover:text-blue-700">
                {token}
              </span>
              <span className="font-semibold text-blue-600 group-hover:text-blue-800">
                {lastValue != null ? lastValue.toFixed(decimals) : "?"}
              </span>
            </Link>
          );
        }

        if (isSeriesName) {
          return (
            <Link
              key={i}
              href={`/udaman/${universe}/series/${id}`}
              className="text-blue-600 underline hover:text-blue-800"
            >
              {token}
            </Link>
          );
        }

        // Whitespace / operators / literals
        return <span key={i}>{token}</span>;
      })}

      {hasValues && resultValue != null && (
        <>
          <span className="mx-1">=</span>
          <span className="font-semibold">{resultValue.toFixed(decimals)}</span>
        </>
      )}
    </div>
  );
}
