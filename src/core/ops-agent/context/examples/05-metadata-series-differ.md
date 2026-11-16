# Example: series in one measurement that differ (placeholder case)

> Illustrative. Replace with a real case and the reviewer's verdict.

**Issue:** measurement `VIS` (Visitor Arrivals): 3 of 10 series have no `unit_id`, and the measurement has none.

**Investigation:** `get_measurement` shows the measurement holds both levels (`VIS@…`, unit "Thousands") and year-over-year growth series (`VIS_YOY@…`, unit "%"). The three without a unit are growth series.

**Action:** one `series_metadata` proposal, `basis: "measurement_series"`, three targets with `after: { unit_id: <percent id> }`, the value the other growth series carry. The measurement is left empty. Evidence says why: the measurement mixes two units, so no single value fits it.

**Why:** putting "Thousands" on the measurement would have labelled the growth series wrongly. When series legitimately differ, the value goes on the series.
