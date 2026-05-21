import {
  TableOfContents,
  type TocItem,
} from "@/components/docs/table-of-contents";
import { Callout, CodeBlock, P } from "@/components/typography";

const tocItems: TocItem[] = [
  { id: "overview", label: "Overview", level: 2 },
  { id: "eval-syntax", label: "Eval Syntax", level: 2 },
  { id: "arithmetic-operators", label: "Arithmetic Operators", level: 2 },
  { id: "arithmetic-methods", label: "Arithmetic Methods", level: 2 },
  { id: "temporal-calculations", label: "Temporal Calculations", level: 2 },
  { id: "aggregation-scaling", label: "Aggregation & Scaling", level: 2 },
  { id: "interpolation", label: "Interpolation", level: 2 },
  { id: "moving-averages", label: "Moving Averages", level: 2 },
  { id: "sharing", label: "Sharing & Allocation", level: 2 },
  { id: "data-adjustment", label: "Data Adjustment", level: 2 },
  { id: "deflation", label: "Deflation (Real Values)", level: 2 },
  { id: "per-capita", label: "Per Capita", level: 2 },
  { id: "seasonal-adjustment", label: "Seasonal Adjustment", level: 2 },
  { id: "file-loading", label: "File Loading", level: 2 },
  { id: "api-loading", label: "API Loading", level: 2 },
  { id: "census-daily", label: "Census & Daily", level: 2 },
];

function MethodBlock({
  name,
  evalName,
  description,
  example,
}: {
  name: string;
  evalName?: string;
  description: string;
  example?: string;
}) {
  return (
    <div className="mt-6 rounded-lg border border-stone-200 p-4 dark:border-stone-700">
      <div className="flex items-baseline gap-2">
        <code className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          {evalName ?? name}
        </code>
      </div>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
        {description}
      </p>
      {example && (
        <pre className="mt-2 overflow-x-auto rounded bg-stone-100 px-3 py-2 text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
          <code>{example}</code>
        </pre>
      )}
    </div>
  );
}

export default function LoaderActionsPage() {
  return (
    <div className="flex flex-1 gap-8 p-4 pt-0">
      <article className="max-w-3xl min-w-0 flex-1">
        <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">
          Loader Actions (Eval Reference)
        </h1>
        <P>
          Reference for all functions and operators available in loader eval
          expressions. Evals define how a series gets its data &mdash; whether
          computed from other series, loaded from a file, or fetched from an
          external API.
        </P>

        {/* ── Overview ─────────────────────────────────────── */}
        <section className="mt-10">
          <h2
            id="overview"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Overview
          </h2>
          <P>
            Every loader in Udaman can have an <strong>eval</strong> field that
            describes how to compute the value of a series. Evals are
            Ruby-flavored expressions that reference other series by name,
            chain method calls, and use arithmetic operators.
          </P>
          <P>
            The result of an eval is always a single time series &mdash; a
            set of date/value pairs that becomes the data for the series being
            loaded.
          </P>
        </section>

        {/* ── Eval Syntax ──────────────────────────────────── */}
        <section className="mt-10">
          <h2
            id="eval-syntax"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Eval Syntax
          </h2>
          <P>Evals use the following building blocks:</P>

          <div className="mt-4 space-y-4 text-sm text-stone-600 dark:text-stone-300">
            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Series reference:
              </strong>{" "}
              Wrap a series name in quotes and append{" "}
              <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
                .ts
              </code>{" "}
              to look it up from the database.
            </div>
            <CodeBlock>{`"E_NF@HI.M".ts`}</CodeBlock>

            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Nullable reference:
              </strong>{" "}
              Use{" "}
              <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
                .tsn
              </code>{" "}
              instead of{" "}
              <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
                .ts
              </code>{" "}
              to return a blank series instead of an error when the series
              doesn&apos;t exist.
            </div>
            <CodeBlock>{`"E_NF@HI.M".tsn`}</CodeBlock>

            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Method calls:
              </strong>{" "}
              Chain methods using dot notation with snake_case names.
            </div>
            <CodeBlock>{`"E_NF@HI.M".ts.yoy`}</CodeBlock>

            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Arguments:
              </strong>{" "}
              Pass arguments in parentheses. Strings use quotes, numbers are
              bare, and Ruby-style keyword arguments are supported.
            </div>
            <CodeBlock>
              {`"E_NF@HI.M".ts.trim("2010-01-01", "2023-12-01")
"E_NF@HI.M".ts.moving_average(window: 12)`}
            </CodeBlock>

            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Series arguments:
              </strong>{" "}
              Pass another series as an argument by quoting its name.
            </div>
            <CodeBlock>
              {`"E_NF@HI.M".ts.add("E_NF@HON.M".ts)`}
            </CodeBlock>

            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Arithmetic:
              </strong>{" "}
              Use standard math operators between series or with numbers.
            </div>
            <CodeBlock>
              {`"E_NF@HI.M".ts + "E_NF@HON.M".ts
"E_NF@HI.M".ts * 1000`}
            </CodeBlock>

            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Static methods:
              </strong>{" "}
              Call data loaders via{" "}
              <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
                Series.method_name(...)
              </code>
              .
            </div>
            <CodeBlock>
              {`Series.load_from_file("path/to/data.xlsx", row: "GDP", col: "2023")`}
            </CodeBlock>

            <div>
              <strong className="text-stone-800 dark:text-stone-100">
                Search + reduce:
              </strong>{" "}
              Find multiple series by keyword and reduce them.
            </div>
            <CodeBlock>
              {`Series.search("E_NF@").sum
Series.search("TOUR").first`}
            </CodeBlock>
          </div>

          <Callout>
            Method names in evals use Ruby-style <code>snake_case</code> (e.g.{" "}
            <code>annual_sum</code>, <code>moving_average</code>). They are
            automatically converted to camelCase internally.
          </Callout>
        </section>

        {/* ── Arithmetic Operators ─────────────────────────── */}
        <section className="mt-14">
          <h2
            id="arithmetic-operators"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Arithmetic Operators
          </h2>
          <P>
            Operators work point-by-point across two series, matching by date.
            You can also use a plain number on one side.
          </P>
          <MethodBlock
            name="+"
            description="Add two series together, or add a number to every value."
            example={`"E_NF@HI.M".ts + "E_NF@HON.M".ts\n"E_NF@HI.M".ts + 100`}
          />
          <MethodBlock
            name="-"
            description="Subtract one series from another, or subtract a number from every value."
            example={`"E_NF@HI.M".ts - "E_NF@HON.M".ts`}
          />
          <MethodBlock
            name="*"
            description="Multiply two series together, or multiply every value by a number."
            example={`"E_NF@HI.M".ts * 1000`}
          />
          <MethodBlock
            name="/"
            description="Divide one series by another, or divide every value by a number."
            example={`"E_NF@HI.M".ts / "NR@HI.M".ts`}
          />
          <MethodBlock
            name="**"
            description="Raise every value to a power."
            example={`"CPI@HON.M".ts ** 2`}
          />
        </section>

        {/* ── Arithmetic Methods ──────────────────────────── */}
        <section className="mt-14">
          <h2
            id="arithmetic-methods"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Arithmetic Methods
          </h2>
          <P>
            Method equivalents of the arithmetic operators, plus a few
            variants with special null handling.
          </P>
          <MethodBlock
            name="add"
            description="Add another series or a number to this series, point by point. Dates that exist in only one series are dropped."
            example={`"E_NF@HI.M".ts.add("E_NF@HON.M".ts)`}
          />
          <MethodBlock
            name="subtract"
            description="Subtract another series or a number from this series, point by point."
            example={`"E_NF@HI.M".ts.subtract("E_NF@HON.M".ts)`}
          />
          <MethodBlock
            name="multiply"
            description="Multiply this series by another series or number, point by point."
            example={`"E_NF@HI.M".ts.multiply(1000)`}
          />
          <MethodBlock
            name="divide"
            description="Divide this series by another series or number, point by point."
            example={`"YPC@HI.M".ts.divide("CPI@HON.M".ts)`}
          />
          <MethodBlock
            name="power"
            description="Raise every value in the series to the given power."
            example={`"CPI@HON.M".ts.power(0.5)`}
          />
          <MethodBlock
            name="zero_add"
            evalName="zero_add"
            description="Add two series together, treating missing values as 0 instead of dropping them. Useful when combining series with different date ranges."
            example={`"E_NF@HI.M".ts.zero_add("E_NF@HON.M".ts)`}
          />
          <MethodBlock
            name="round"
            description="Round every value to the given number of decimal places (default: 0)."
            example={`"E_NF@HI.M".ts.round(2)`}
          />
        </section>

        {/* ── Temporal Calculations ────────────────────────── */}
        <section className="mt-14">
          <h2
            id="temporal-calculations"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Temporal Calculations
          </h2>
          <P>
            Methods that compute period-over-period or year-over-year
            transformations.
          </P>
          <MethodBlock
            name="yoy"
            description="Year-over-year percent change. Compares each value to the same period one year ago and returns the percentage difference. Also available as annualized_percentage_change."
            example={`"E_NF@HI.M".ts.yoy\n# If Jan 2023 = 110 and Jan 2022 = 100, result = 10.0`}
          />
          <MethodBlock
            name="diff"
            evalName="diff"
            description="Period-over-period difference. Returns the level change between consecutive observations. Also available as absolute_change."
            example={`"E_NF@HI.M".ts.diff\n# If Feb = 110 and Jan = 100, result for Feb = 10`}
          />
          <MethodBlock
            name="percentage_change"
            evalName="percentage_change"
            description="Period-over-period percentage change. Compares each value to the immediately prior observation."
            example={`"E_NF@HI.M".ts.percentage_change`}
          />
          <MethodBlock
            name="yoy_diff"
            evalName="yoy_diff"
            description="Year-over-year difference in levels (not percent). Subtracts the value from 12 months ago."
            example={`"E_NF@HI.M".ts.yoy_diff\n# If Jan 2023 = 110 and Jan 2022 = 100, result = 10`}
          />
          <MethodBlock
            name="annual_sum"
            evalName="annual_sum"
            description="Replaces each value with the sum of all values in its calendar year. Every month in 2023 gets the total for 2023."
            example={`"E_NF@HI.M".ts.annual_sum`}
          />
          <MethodBlock
            name="annual_average"
            evalName="annual_average"
            description="Replaces each value with the average of all values in its calendar year. Every month in 2023 gets the 2023 average."
            example={`"CPI@HON.M".ts.annual_average`}
          />
          <MethodBlock
            name="ytd"
            description="Year-to-date: computes the cumulative sum from January through the current month, then takes the year-over-year percent change of that running total."
            example={`"E_NF@HI.M".ts.ytd`}
          />
          <MethodBlock
            name="ytd_sum"
            evalName="ytd_sum"
            description="Year-to-date cumulative sum. For each month, sums all values from January of that year through the current month."
            example={`"TAX@HI.M".ts.ytd_sum\n# Mar 2023 = Jan + Feb + Mar of 2023`}
          />
          <MethodBlock
            name="mtd"
            description="Month-to-date year-over-year change (daily series only). Computes the month-to-date running average, then takes the YOY percent change."
            example={`"VISITOR@HI.D".ts.mtd`}
          />
          <MethodBlock
            name="mtd_sum"
            evalName="mtd_sum"
            description="Month-to-date cumulative sum (daily series only). Running sum from the 1st of the month through the current day."
            example={`"VISITOR@HI.D".ts.mtd_sum`}
          />
          <MethodBlock
            name="mtd_avg"
            evalName="mtd_avg"
            description="Month-to-date running average (daily series only). The MTD sum divided by the day of the month."
            example={`"VISITOR@HI.D".ts.mtd_avg`}
          />
        </section>

        {/* ── Aggregation & Scaling ────────────────────────── */}
        <section className="mt-14">
          <h2
            id="aggregation-scaling"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Aggregation & Scaling
          </h2>
          <MethodBlock
            name="average"
            description="Returns the simple average of all data points as a single-value series. Useful in arithmetic expressions like dividing by an average."
            example={`"E_NF@HI.M".ts.divide("E_NF@HI.M".ts.average)`}
          />
          <MethodBlock
            name="aggregate"
            description="Aggregate to a lower frequency (e.g. monthly to quarterly or annual). Specify the target frequency and the aggregation method (sum or average)."
            example={`"E_NF@HI.M".ts.aggregate("quarter", :sum)\n"CPI@HON.M".ts.aggregate("year", :average)`}
          />
          <MethodBlock
            name="scaled_data"
            evalName="scaled_data"
            description="Multiply every value by a scaling factor. Returns a new series with scaled values."
            example={`"E_NF@HI.M".ts.scaled_data(1000)`}
          />
          <MethodBlock
            name="rebase"
            description="Rebase the series to a given year (index = 100). Divides every value by the annual series value at the specified date, then multiplies by 100. If no date is given, uses the last available year."
            example={`"CPI@HON.M".ts.rebase(2010)\n"CPI@HON.Q".ts.rebase`}
          />
        </section>

        {/* ── Interpolation ────────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="interpolation"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Interpolation
          </h2>
          <P>
            Methods for converting between frequencies (e.g. annual to
            monthly) or filling in missing data points.
          </P>
          <MethodBlock
            name="interpolate"
            description='Interpolate to a higher frequency. Method can be "average" (distribute evenly so sub-periods average to the source) or "sum" (distribute so sub-periods sum to the source).'
            example={`"GDP@HI.A".ts.interpolate(:quarter, :average)\n"TAX@HI.A".ts.interpolate(:month, :sum)`}
          />
          <MethodBlock
            name="linear_interpolate"
            evalName="linear_interpolate"
            description="Linear match-last interpolation to the given frequency. Draws a straight line between known values, matching the last sub-period to the source value."
            example={`"GDP@HI.A".ts.linear_interpolate(:quarter)`}
          />
          <MethodBlock
            name="fill_interpolate_to"
            evalName="fill_interpolate_to"
            description="Forward-fill interpolation to a higher frequency. Each source value is repeated across all sub-periods (e.g. an annual value fills all 12 months)."
            example={`"POP@HI.A".ts.fill_interpolate_to(:month)`}
          />
          <MethodBlock
            name="census_interpolate"
            evalName="census_interpolate"
            description="Census Bureau-style interpolation from annual to quarterly. Uses a specific algorithm designed for census data that preserves annual totals."
            example={`"POP@HI.A".ts.census_interpolate`}
          />
          <MethodBlock
            name="trms_interpolate_to_quarterly"
            evalName="trms_interpolate_to_quarterly"
            description="TRMS method interpolation from annual to quarterly. A specialized interpolation technique that generates quarterly values from annual data."
            example={`"GDP@HI.A".ts.trms_interpolate_to_quarterly`}
          />
          <MethodBlock
            name="pseudo_centered_spline_interpolation"
            evalName="pseudo_centered_spline_interpolation"
            description="Pseudo-centered spline interpolation. Uses a spline curve to smoothly interpolate between known values, centering the result around the mid-point of each period."
            example={`"GDP@HI.A".ts.pseudo_centered_spline_interpolation`}
          />
          <MethodBlock
            name="fill_missing_months_linear"
            evalName="fill_missing_months_linear"
            description="Fill gaps in monthly data with linear interpolation. Draws a straight line between the last known value and the next known value to fill missing months."
            example={`"CPI@HON.M".ts.fill_missing_months_linear`}
          />
          <MethodBlock
            name="fill_alternate_missing_months"
            evalName="fill_alternate_missing_months"
            description="For a series with data every other month, fill the gaps by averaging the two adjacent months. If a semi-annual sibling series exists, it is used to mean-correct each 6-month block."
            example={`"TOUR@HI.M".ts.fill_alternate_missing_months\n"TOUR@HI.M".ts.fill_alternate_missing_months(from: "2010-01-01", to: "2023-12-01")`}
          />
          <MethodBlock
            name="add_missing_dp"
            evalName="add_missing_dp"
            description="Insert a specific missing data point using a given operation (e.g. average of neighbors, or sum). Useful for patching a single gap in a series."
            example={`"E_NF@HI.M".ts.add_missing_dp("2023-07-01", :average)`}
          />
          <MethodBlock
            name="extend_last_fwd_to_match"
            evalName="extend_last_fwd_to_match"
            description="Extend the last known value forward (flat-line) until it reaches the last date of a reference series. Useful for carrying a value forward to match another series' time span."
            example={`"POP@HI.Q".ts.extend_last_fwd_to_match("GDP@HI.Q")`}
          />
          <MethodBlock
            name="distribute_days_interpolation"
            evalName="distribute_days_interpolation"
            description="Distribute weekly data to daily frequency using interpolation. Spreads each weekly value across the days of the week."
            example={`"CLAIMS@HI.W".ts.distribute_days_interpolation`}
          />
          <MethodBlock
            name="fill_days_interpolation"
            evalName="fill_days_interpolation"
            description="Forward-fill weekly data to daily frequency. Each weekly value is repeated for every day in that week."
            example={`"CLAIMS@HI.W".ts.fill_days_interpolation`}
          />
        </section>

        {/* ── Moving Averages ──────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="moving-averages"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Moving Averages
          </h2>
          <P>
            Smoothing methods that average values over a rolling window. The
            default window size is typically derived from the series frequency
            (e.g. 12 for monthly, 4 for quarterly).
          </P>
          <MethodBlock
            name="moving_average"
            evalName="moving_average"
            description="Centered moving average. Each point is the average of the surrounding window. At the edges of the series, it falls back to forward-looking or backward-looking to avoid losing data."
            example={`"E_NF@HI.M".ts.moving_average`}
          />
          <MethodBlock
            name="moving_average_offset_early"
            evalName="moving_average_offset_early"
            description="Centered moving average with the window shifted one position to the right. Similar to a standard centered MA but slightly offset earlier in time."
            example={`"E_NF@HI.M".ts.moving_average_offset_early`}
          />
          <MethodBlock
            name="backward_looking_moving_average"
            evalName="backward_looking_moving_average"
            description="Each point is the average of itself and the preceding values in the window. Only uses past data, so it never looks ahead. Optional window parameter."
            example={`"E_NF@HI.M".ts.backward_looking_moving_average\n"E_NF@HI.M".ts.backward_looking_moving_average(window: 14)`}
          />
          <MethodBlock
            name="forward_looking_moving_average"
            evalName="forward_looking_moving_average"
            description="Each point is the average of itself and the following values in the window. Only uses future data. Optional window parameter."
            example={`"E_NF@HI.M".ts.forward_looking_moving_average\n"E_NF@HI.M".ts.forward_looking_moving_average(window: 6)`}
          />
          <MethodBlock
            name="offset_forward_looking_moving_average"
            evalName="offset_forward_looking_moving_average"
            description="Forward-looking moving average with the window shifted one position to the right. Does not adapt at edges."
            example={`"E_NF@HI.M".ts.offset_forward_looking_moving_average`}
          />
          <MethodBlock
            name="moving_average_annavg_padded"
            evalName="moving_average_annavg_padded"
            description="Centered moving average that pads the edges with annual average values instead of truncating. Produces a smoother result at the start and end of the series."
            example={`"E_NFNS@HI.M".ts.moving_average_annavg_padded`}
          />
        </section>

        {/* ── Sharing & Allocation ─────────────────────────── */}
        <section className="mt-14">
          <h2
            id="sharing"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Sharing & County Allocation
          </h2>
          <P>
            Methods for distributing state-level data to counties using
            various ratio-based approaches. These are the primary tools for
            producing county-level estimates from state totals.
          </P>
          <MethodBlock
            name="mc_ma_county_share_for"
            evalName="mc_ma_county_share_for"
            description='Moving-average mean-corrected county share. Computes the ratio of county-to-state using their moving averages, applies that ratio to the target series, then mean-corrects so the county values sum to match the actual county annual totals. The first argument is the county code (e.g. "MAUI", "HAW"). An optional second argument overrides the series prefix.'
            example={`"VISDEMETRA_MC@HI.M".ts.mc_ma_county_share_for("MAUI")\n"E_NF@HI.M".ts.mc_ma_county_share_for("HAW", "E_NFNS")`}
          />
          <MethodBlock
            name="mc_price_share_for"
            evalName="mc_price_share_for"
            description='Mean-corrected price share. Similar to mc_ma_county_share_for but designed for price indices. Computes county share using moving average ratios of the NS (not seasonally adjusted) counterparts, mean-corrects against county annual averages, and patches the most recent incomplete year with a backward-looking MA correction.'
            example={`"CPI@HI.M".ts.mc_price_share_for("HON")`}
          />
          <MethodBlock
            name="aa_state_based_county_share_for"
            evalName="aa_state_based_county_share_for"
            description='Annual-average county share. Uses the ratio of county-to-state annual averages (instead of moving averages) to distribute the target series to a county. Simpler than the MA-based methods. The first argument is the county code, and an optional second argument overrides the series prefix.'
            example={`"CPI@HI.Q".ts.aa_state_based_county_share_for("KAU")`}
          />
          <MethodBlock
            name="share_using"
            evalName="share_using"
            description="Compute a share using two ratio series: (ratioTop / ratioBottom) * self. Useful for custom sharing calculations that don't fit the county-share templates."
            example={`"GDP@HI.A".ts.share_using("GDP@HON.A".ts, "GDP@US.A".ts)`}
          />
        </section>

        {/* ── Data Adjustment ──────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="data-adjustment"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Data Adjustment
          </h2>
          <P>
            Methods for trimming, shifting, or otherwise adjusting the date
            range and shape of a series.
          </P>
          <MethodBlock
            name="trim"
            description='Restrict the series to a specific date range. Pass start and end dates as positional arguments, or use before:/after: keyword arguments. Omit either end to leave it open.'
            example={`"E_NF@HI.M".ts.trim("2010-01-01", "2023-12-01")\n"E_NF@HI.M".ts.trim(before: "2010-01-01")\n"E_NF@HI.M".ts.trim(after: "2023-12-01")`}
          />
          <MethodBlock
            name="no_trim_past"
            evalName="no_trim_past"
            description="Disable start-date trimming. Ensures all historical data is preserved even when other operations would normally clip it. Chainable."
            example={`"E_NF@HI.M".ts.no_trim_past.yoy`}
          />
          <MethodBlock
            name="no_trim_future"
            evalName="no_trim_future"
            description="Disable end-date trimming. Ensures future/forecast data is preserved even when other operations would normally clip it. Chainable."
            example={`"E_NF@HI.M".ts.no_trim_future.annual_sum`}
          />
          <MethodBlock
            name="shift_by"
            evalName="shift_by"
            description="Shift all dates forward or backward by a given number of months. Positive values move data forward in time, negative values move it backward."
            example={`"E_NF@HI.M".ts.shift_by(12)\n# Shifts all dates forward by 12 months`}
          />
          <MethodBlock
            name="get_last_incomplete_year"
            evalName="get_last_incomplete_year"
            description="Extract only the data from the current (incomplete) calendar year. Useful for isolating the most recent partial-year data."
            example={`"E_NF@HI.M".ts.get_last_incomplete_year`}
          />
          <MethodBlock
            name="get_last_complete_december"
            evalName="get_last_complete_december"
            description="Returns the date of the last December that has data. Used internally by county share methods to determine where full-year calculations end."
            example={`"E_NF@HI.M".ts.get_last_complete_december`}
          />
          <MethodBlock
            name="get_last_complete_4th_quarter"
            evalName="get_last_complete_4th_quarter"
            description="Returns the date of the last complete Q4 (October-December) that has data. Used internally by price share methods."
            example={`"CPI@HON.Q".ts.get_last_complete_4th_quarter`}
          />
        </section>

        {/* ── Deflation ────────────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="deflation"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Deflation (Real Values)
          </h2>
          <P>
            Convert nominal (current-dollar) values into real
            (constant-dollar) values by dividing by a price index.
          </P>
          <MethodBlock
            name="convert_to_real"
            evalName="convert_to_real"
            description="Deflate using a price index. By default uses CPI at the target geography. The formula is: (value / index) * 100. For Hawaii geographies, it tries CPI@HON first, then falls back to CPI@HI. You can specify a different index prefix with the index: keyword."
            example={`"YPC@HI.A".ts.convert_to_real\n"YPC@HI.A".ts.convert_to_real(index: "PCEPI")\n"YPC@HI.A".ts.convert_to_real("CPI@HON.A")`}
          />
          <MethodBlock
            name="convert_to_real_b"
            evalName="convert_to_real_b"
            description='Same as convert_to_real but uses the "_B" (base-year) variant of the price index. For example, index: "CPI" will look up "CPI_B" series.'
            example={`"YPC@HI.A".ts.convert_to_real_b\n"YPC@HI.A".ts.convert_to_real_b(index: "PCEPI")`}
          />
        </section>

        {/* ── Per Capita ───────────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="per-capita"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Per Capita
          </h2>
          <P>
            Divide by a population series to produce per-person values.
          </P>
          <MethodBlock
            name="per_cap"
            evalName="per_cap"
            description="Per capita: divides by the resident population series (NR@GEO.FREQ) and multiplies by 100. Automatically matches the target geography and frequency. You can pass a specific population series or override with keyword arguments."
            example={`"E_NF@HI.M".ts.per_cap\n"E_NF@HI.M".ts.per_cap(pop: "NRC", multiplier: 1000)`}
          />
          <MethodBlock
            name="per_1kcap"
            evalName="per_1kcap"
            description="Per 1,000 capita: same as per_cap but multiplies by 1,000 instead of 100. Uses resident population (NR) by default."
            example={`"E_NF@HI.M".ts.per_1kcap`}
          />
          <MethodBlock
            name="per_cap_civilian"
            evalName="per_cap_civilian"
            description='Per capita using civilian population (NRC) instead of total resident population (NR). Multiplies by 100.'
            example={`"E_NF@HI.M".ts.per_cap_civilian`}
          />
        </section>

        {/* ── Seasonal Adjustment ──────────────────────────── */}
        <section className="mt-14">
          <h2
            id="seasonal-adjustment"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Seasonal Adjustment
          </h2>
          <MethodBlock
            name="apply_ns_growth_rate_sa"
            evalName="apply_ns_growth_rate_sa"
            description="Growth-rate-based seasonal adjustment. Looks up the NS (not seasonally adjusted) counterpart of this series, computes its year-over-year growth rate, and applies that growth rate to the SA series shifted by one year. Produces an adjusted value that follows the NS growth pattern but starts from the SA level."
            example={`"E_NF@HI.M".ts.apply_ns_growth_rate_sa`}
          />
        </section>

        {/* ── File Loading ─────────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="file-loading"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            File Loading (Instance)
          </h2>
          <P>
            Load data from local files (Excel, CSV, TSD). The series name is
            used to look up the correct row/column in the file.
          </P>
          <MethodBlock
            name="load_from"
            evalName="load_from"
            description='Load data from a static file. Supports Excel (.xlsx, .xls), CSV, and TSD file formats. The series name is used to find the matching data in the file. An optional second argument specifies the sheet name for Excel files.'
            example={`"E_NF@HI.M".ts.load_from("data/employment.xlsx")\n"E_NF@HI.M".ts.load_from("data/output.xlsx", "Sheet2")\n"E_NF@HI.M".ts.load_from("data/series.tsd")`}
          />
          <MethodBlock
            name="load_sa_from"
            evalName="load_sa_from"
            description='Load seasonally-adjusted data from a demetra output file. Defaults to the "sadata" sheet. Looks up the NS (not seasonally adjusted) variant of the series name in the file.'
            example={`"E_NF@HI.M".ts.load_sa_from("data/demetra_output.xlsx")\n"E_NF@HI.M".ts.load_sa_from("data/demetra.xlsx", sheet: "custom_sheet")`}
          />
          <MethodBlock
            name="load_mean_corrected_sa_from"
            evalName="load_mean_corrected_sa_from"
            description='Load seasonally-adjusted data from a demetra file and mean-correct it. Loads the SA series from the file, then adjusts it so its annual sums match the actual NS series from the database. Formula: (demetra / demetra.annual_sum) * ns.annual_sum.'
            example={`"E_NF@HI.M".ts.load_mean_corrected_sa_from("data/demetra_output.xlsx")`}
          />
        </section>

        {/* ── API Loading ──────────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="api-loading"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            API Loading (Static)
          </h2>
          <P>
            Static methods that fetch data from external APIs. Called via{" "}
            <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">
              Series.method_name(...)
            </code>
            .
          </P>
          <MethodBlock
            name="Series.load_from_download"
            evalName="Series.load_from_download"
            description='Load data from a download handle using cell navigation. Specify the row, column, sheet, and frequency to locate the data within a downloaded file.'
            example={`Series.load_from_download("handle_name", row: "GDP", col: "2023", frequency: "year")`}
          />
          <MethodBlock
            name="Series.load_from_file"
            evalName="Series.load_from_file"
            description="Load data from a file path using cell navigation. Similar to load_from_download but takes a direct file path instead of a download handle."
            example={`Series.load_from_file("path/to/data.xlsx", row: "GDP", col: "2023")`}
          />
          <MethodBlock
            name="Series.load_from_factbook"
            evalName="Series.load_from_factbook"
            description='Load from the Hawaii Housing Factbook file. Specify the measurement prefix and a geography handle (zip code or county name).'
            example={`Series.load_from_factbook("ZMEDPRICE", "96822")\nSeries.load_from_factbook("MEDSALEPRICE", "honolulu")`}
          />
          <MethodBlock
            name="Series.load_api_bls"
            evalName="Series.load_api_bls"
            description="Load from the Bureau of Labor Statistics (BLS) API. Fetches full history by walking backwards in 20-year chunks. Pass the BLS series ID and optional start/end years."
            example={`Series.load_api_bls("LAUST150000000000003")\nSeries.load_api_bls("LAUST150000000000003", 2000, 2023)`}
          />
          <MethodBlock
            name="Series.load_api_bls_NEW"
            evalName="Series.load_api_bls_NEW"
            description="Load from the BLS API v2 endpoint. A newer version of the BLS loader."
            example={`Series.load_api_bls_NEW("LAUST150000000000003")`}
          />
          <MethodBlock
            name="Series.load_api_fred"
            evalName="Series.load_api_fred"
            description="Load from the Federal Reserve Economic Data (FRED) API. Optionally specify frequency and aggregation method."
            example={`Series.load_api_fred("GDP")\nSeries.load_api_fred("UNRATE", frequency: "monthly")`}
          />
          <MethodBlock
            name="Series.load_api_bea"
            evalName="Series.load_api_bea"
            description="Load from the Bureau of Economic Analysis (BEA) API. Specify frequency, dataset, and any required parameters."
            example={`Series.load_api_bea("SAGDP2N", frequency: "annual", dataset: "Regional")`}
          />
          <MethodBlock
            name="Series.load_api_estatjp"
            evalName="Series.load_api_estatjp"
            description="Load from the Japan e-Stat API. Returns monthly data. Pass the stat ID and filter parameters."
            example={`Series.load_api_estatjp("0003348423", cdCat01: "010")`}
          />
          <MethodBlock
            name="Series.load_api_eia_aeo"
            evalName="Series.load_api_eia_aeo"
            description="Load from the EIA Annual Energy Outlook API. Specify route, scenario, series ID, and frequency."
            example={`Series.load_api_eia_aeo(route: "electricity", scenario: "ref2023", seriesId: "gen_NA_US_NA_SLR_NA_NA_ANN")`}
          />
          <MethodBlock
            name="Series.load_api_eia_steo"
            evalName="Series.load_api_eia_steo"
            description="Load from the EIA Short-Term Energy Outlook API. Specify the series ID and frequency."
            example={`Series.load_api_eia_steo(seriesId: "PAPR_WORLD", frequency: "monthly")`}
          />
          <MethodBlock
            name="Series.load_api_dvw"
            evalName="Series.load_api_dvw"
            description="Load from the DVW API. Specify the module, frequency, indicator, and any dimension filters."
            example={`Series.load_api_dvw(module: "tourism", frequency: "monthly", indicator: "arrivals")`}
          />

          <Callout>
            Static methods also include{" "}
            <code>Series.search(&quot;text&quot;)</code> which finds multiple
            series by name pattern. It must be followed by a reduction:{" "}
            <code>.sum</code>, <code>.first</code>, or <code>.last</code>.
          </Callout>
          <MethodBlock
            name="Series.search().sum"
            evalName='Series.search("pattern").sum'
            description="Find all series matching a name pattern and sum them point by point."
            example={`Series.search("E_NF@").sum`}
          />
          <MethodBlock
            name="Series.search().first"
            evalName='Series.search("pattern").first'
            description="Find all series matching a name pattern and return the first match."
            example={`Series.search("E_NF@HI").first`}
          />
          <MethodBlock
            name="Series.search().last"
            evalName='Series.search("pattern").last'
            description="Find all series matching a name pattern and return the last match."
            example={`Series.search("E_NF@HI").last`}
          />
        </section>

        {/* ── Census & Daily ───────────────────────────────── */}
        <section className="mt-14">
          <h2
            id="census-daily"
            className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100"
          >
            Census & Daily
          </h2>
          <MethodBlock
            name="daily_census"
            evalName="daily_census"
            description="Census-style daily expansion. For seasonally adjusted series, treats each day equally (1 day per period). For not-seasonally-adjusted series, weights by the actual number of days in each period."
            example={`"VISITOR@HI.M".ts.daily_census`}
          />
          <MethodBlock
            name="days_in_period"
            evalName="days_in_period"
            description="Replace each observation's value with the number of days in that observation's period. For monthly data, returns the number of days in each month (28-31). For quarterly, the days in that quarter, etc."
            example={`"E_NF@HI.M".ts.days_in_period`}
          />
        </section>

        {/* ── Combining it all ─────────────────────────────── */}
        <section className="mt-14 mb-20">
          <h2 className="scroll-mt-20 text-2xl font-semibold text-stone-800 dark:text-stone-100">
            Putting It Together
          </h2>
          <P>
            Evals can chain multiple methods and operators to build complex
            calculations. Here are a few real-world examples:
          </P>
          <CodeBlock>
            {`# County share allocation for visitor spending on Maui
"VISDEMETRA_MC@HI.M".ts.mc_ma_county_share_for("MAUI", "VIS")

# Real per-capita income: deflate by CPI then divide by population
"YPC@HI.A".ts.convert_to_real.per_cap

# Annual sum of two employment series
"E_NF@HI.M".ts.add("E_NF@HON.M".ts).annual_sum

# Load from BLS, then compute year-over-year change
Series.load_api_bls("LAUST150000000000003").yoy

# Interpolate annual GDP to quarterly, trim to range
"GDP@HI.A".ts.interpolate(:quarter, :average).trim("2010-01-01", "2023-12-01")

# Sum all matching series
Series.search("E_NF@").sum`}
          </CodeBlock>
        </section>
      </article>

      {/* Table of Contents sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-20">
          <TableOfContents items={tocItems} />
        </div>
      </aside>
    </div>
  );
}
