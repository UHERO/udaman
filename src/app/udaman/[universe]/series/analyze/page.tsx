import {
  compareSeriesAction,
  getCompareAllGeosAction,
  getCompareSANSAction,
  transformSeriesAction,
} from "@/actions/series-actions";

import { AnalyzeControls } from "@/components/series/analyze-controls";
import { AnalyzeLayout } from "@/components/series/analyze-layout";
import { CalculateForm } from "@/components/series/calculate-form";
import { CompareSeriesBadges } from "@/components/series/compare-series-badges";
import { CompareSuggestions } from "@/components/series/compare-suggestions";
import { LinkedExpression } from "@/components/series/linked-expression";
import { H2 } from "@/components/typography";

const NAME_REGEX =
  /^(([%$\w]+?)(&([0-9Q]+)([FH])(\d+|F))?)@(\w+?)\.([ASQMWD])$/i;

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
        <AnalyzeLayout>
          <H2>Calculate</H2>
          <CalculateForm />
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              Enter an expression using series names and operators to compute a
              derived series, or comma-separated names to compare. For example:
            </p>
            <ul className="list-inside list-disc space-y-1 font-mono text-xs">
              <li>E_NF@HI.M + E_NF@MAU.M</li>
              <li>E_NF@HI.M / E_NF@HI.M.shift_by(12)</li>
              <li>VISRESNS@NBI.M,VISRESNS@HAW.M</li>
            </ul>
          </div>
        </AnalyzeLayout>
      </div>
    );
  }

  // ── Detect compare mode: comma-separated valid series names ────────
  const names = expression
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isCompare = names.length >= 2 && names.every((n) => NAME_REGEX.test(n));

  if (isCompare) {
    const result = await compareSeriesAction(names);

    if ("error" in result) {
      return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <AnalyzeLayout>
            <H2>Compare</H2>
            <CalculateForm initialExpression={expression} />
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                Error loading series
              </p>
              <p className="mt-1 font-mono text-xs text-red-600">
                {result.error}
              </p>
            </div>
          </AnalyzeLayout>
        </div>
      );
    }

    const { series, seriesLinks } = result;
    const firstDecimals = series[0]?.decimals ?? 1;
    const suggestionName = names[0];

    const [allGeosNames, saNsNames] = await Promise.all([
      getCompareAllGeosAction(suggestionName, universe),
      getCompareSANSAction(suggestionName),
    ]);

    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AnalyzeLayout>
          <H2>Compare</H2>

          <CalculateForm initialExpression={expression}>
            <CompareSuggestions
              allGeosNames={allGeosNames}
              saNsNames={saNsNames}
              universe={universe}
            />
          </CalculateForm>

          {seriesLinks && Object.keys(seriesLinks).length > 0 && (
            <CompareSeriesBadges
              names={names}
              seriesLinks={seriesLinks}
              universe={universe}
            />
          )}

          <AnalyzeControls
            data={[]}
            yoy={[]}
            ytd={[]}
            levelChange={[]}
            decimals={firstDecimals}
            compareSeries={series.map((s) => ({
              name: s.name,
              data: s.data,
            }))}
            currentFreqCode={series[0]?.frequencyCode}
          />
        </AnalyzeLayout>
      </div>
    );
  }

  // ── Expression mode (existing flow) ────────────────────────────────
  const result = await transformSeriesAction(expression);

  if ("error" in result) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <AnalyzeLayout>
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

  // Show suggestions if the expression is a single valid series name
  const isSingleName = NAME_REGEX.test(expression.trim());
  const [allGeosNames, saNsNames] = isSingleName
    ? await Promise.all([
        getCompareAllGeosAction(expression.trim(), universe),
        getCompareSANSAction(expression.trim()),
      ])
    : [null, null];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <AnalyzeLayout>
        <H2>Calculate</H2>

        <CalculateForm initialExpression={expression}>
          <CompareSuggestions
            allGeosNames={allGeosNames}
            saNsNames={saNsNames}
            universe={universe}
          />
        </CalculateForm>

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
