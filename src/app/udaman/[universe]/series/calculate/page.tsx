import { transformSeriesAction } from "@/actions/series-actions";
import { AnalyzeControls } from "@/components/series/analyze-controls";
import { AnalyzeLayout } from "@/components/series/analyze-layout";
import { AnalyzeTabs } from "@/components/series/analyze-tabs";
import { CalculateForm } from "@/components/series/calculate-form";
import { LinkedExpression } from "@/components/series/linked-expression";
import { RecentSeriesList } from "@/components/series/recent-series-list";
import { H2 } from "@/components/typography";

const NAME_REGEX =
  /^(([%$\w]+?)(&([0-9Q]+)([FH])(\d+|F))?)@(\w+?)\.([ASQMWD])$/i;

/** Extract the first valid series name from an expression */
function extractFirstName(expr: string): string | null {
  const tokens = expr
    .replace(/([+*/(),-])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean);
  return tokens.find((t) => NAME_REGEX.test(t)) ?? null;
}

export default async function CalculatePage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { universe } = await params;
  const { eval: evalStr } = await searchParams;
  const expression = typeof evalStr === "string" ? evalStr : undefined;

  // No expression — show form + instructions + recent series
  if (!expression) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AnalyzeLayout>
          <AnalyzeTabs />
          <H2>Calculate</H2>
          <CalculateForm />
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              Enter an expression using series names and operators to compute a
              derived series. For example:
            </p>
            <ul className="list-inside list-disc space-y-1 font-mono text-xs">
              <li>E_NF@HI.M + E_NF@MAU.M</li>
              <li>E_NF@HI.M / E_NF@HI.M.shift_by(12)</li>
              <li>E_NF@HI.M * 100</li>
            </ul>
          </div>
          <RecentSeriesList mode="calculate" />
        </AnalyzeLayout>
      </div>
    );
  }

  // ── Expression mode ──────────────────────────────────────────────────
  const result = await transformSeriesAction(expression);
  const firstName = extractFirstName(expression);

  if ("error" in result) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AnalyzeLayout>
          <AnalyzeTabs firstSeriesName={firstName} hasParams />
          <H2>Calculate</H2>
          <CalculateForm initialExpression={expression} />
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">
              Error evaluating expression
            </p>
            <p className="mt-1 font-mono text-xs text-red-600">
              {result.error}
            </p>
          </div>
        </AnalyzeLayout>
      </div>
    );
  }

  const {
    series,
    yoy,
    levelChange,
    ytd,
    seriesLinks,
    seriesLastValues,
    resultValue,
    resultDate,
  } = result;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AnalyzeLayout>
        <AnalyzeTabs
          firstSeriesId={series.id}
          firstSeriesName={firstName}
          hasParams
        />
        <H2>Calculate</H2>

        <CalculateForm initialExpression={expression} />

        {seriesLinks && Object.keys(seriesLinks).length > 0 && (
          <LinkedExpression
            expression={expression}
            universe={universe}
            seriesLinks={seriesLinks}
            seriesLastValues={seriesLastValues}
            resultValue={resultValue}
            resultDate={resultDate}
            decimals={series.decimals}
          />
        )}

        <AnalyzeControls
          data={series.data}
          yoy={yoy}
          ytd={ytd}
          levelChange={levelChange}
          decimals={series.decimals}
        />
      </AnalyzeLayout>
    </div>
  );
}
