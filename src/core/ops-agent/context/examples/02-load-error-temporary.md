# Example: temporary API failure (placeholder case)

> Illustrative. Replace with a real case.

**Issue:** `load_api_bls` loader for `EMPL@HI.M` failed overnight with `BLS API HTTP 503`. Other BLS loaders in the same batch succeeded.

**Investigation:** `get_app_logs` for the loader showed one failure, none before. `probe_source_url` on the BLS API host returns 200 now. Nothing in the load statement or our code changed.

**Action:** `propose_change` kind `reload` with the evidence "single 503 during the nightly batch; host is healthy now; no changes since the last good run". If reloads were at autonomy level 1, this would have run directly.

**Why:** don't change anything when the evidence says the failure was temporary. If it fails again, the issue reopens and gets a fresh look.
