# Example: dependent series failing because an input broke (placeholder case)

> Illustrative. Replace with a real case.

**Issue:** `VISPNS@HI.Q` (computed: `"VISNS@HI.M".ts.aggregate(:quarter, :sum)`) errors with `series VISNS@HI.M has no data`.

**Investigation:** `get_series` on `VISNS@HI.M` shows its own loader erroring since the same night (a separate load_error issue with a header-match failure). The dependent has no problem of its own.

**Action:** diagnosis comment on the dependent: "Fails because its input VISNS@HI.M is failing (issue #…); will recover when that loader is fixed." Then work the input's issue instead (or note that it's already queued). No proposal on the dependent.

**Why:** fixing the root fixes every dependent; the reconciler closes the dependent's issue automatically once its reload succeeds.
