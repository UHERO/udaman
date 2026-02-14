import { transformSeriesAction } from "@/actions/series-actions";
import { AnalyzeControls } from "@/components/series/analyze-controls";
import { AnalyzeDataTable } from "@/components/series/analyze-data-table";
import { CalculateForm } from "@/components/series/calculate-form";
import { LinkedExpression } from "@/components/series/linked-expression";
import { H2 } from "@/components/typography";

export default async function TransformSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ universe: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { universe } = await params;
  const { eval: evalStr } = await searchParams;
  const expression = typeof evalStr === "string" ? evalStr : undefined;

  // No expression — show form + instructions
  if (!expression) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <main className="m-4 max-w-5xl space-y-6">
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
              <li>
                E_NF@HI.Q.aggregate(&quot;quarter&quot;, &quot;average&quot;)
              </li>
            </ul>
          </div>
        </main>
      </div>
    );
  }

  // Has expression — evaluate and display
  const result = await transformSeriesAction(expression);

  if ("error" in result) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <main className="m-4 max-w-5xl space-y-6">
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
        </main>
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
  } = result;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <main className="m-4 max-w-5xl space-y-6">
        <H2>Calculate</H2>

        <CalculateForm initialExpression={expression} />

        {seriesLinks && Object.keys(seriesLinks).length > 0 && (
          <LinkedExpression
            expression={expression}
            universe={universe}
            seriesLinks={seriesLinks}
            seriesLastValues={seriesLastValues}
            resultValue={resultValue}
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

        <AnalyzeDataTable
          data={series.data}
          yoy={yoy}
          levelChange={levelChange}
          ytd={ytd}
          decimals={series.decimals}
        />
      </main>
    </div>
  );
}
