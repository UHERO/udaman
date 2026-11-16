# Example: a source set on the measurement (placeholder case)

> Illustrative. Replace with a real case and the reviewer's verdict.

**Issue:** measurement `E_NF` (Nonfarm Payrolls): 7 of 12 series have no `source_id`, and the measurement has none.

**Investigation:** `get_measurement` shows the five series with a source all carry the BLS row, and all twelve are the same measure for different counties and frequencies. The loaders of the seven without one are `load_api_bls(…)` or aggregate a series that is.

**Action:** one `measurement_metadata` proposal, `basis: "measurement_series"`, target = the measurement, `after: { source_id: <BLS id> }`. Evidence lists the five series the value came from and notes that the other seven load from the BLS API.

**Why:** the value is the same for every series, so it belongs on the measurement: the seven empty series now show it, and so will any series added later. Nothing already set was touched.
