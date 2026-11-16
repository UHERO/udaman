# Field: source_id (the publishing organization)

- The load statement usually names it: the API (`load_api_bls` → U.S. Bureau of Labor Statistics), the download handle's domain, or the extract source.
- Other series in the measurement nearly always share the source. Where they all do, the value goes on the measurement.
- Computed series (arithmetic on other series) take the source of their inputs when all inputs share one. When inputs mix sources, ask.

TODO(economists): rules for UHERO-computed series (is the source UHERO, or the underlying agency?), and the preferred `sources` rows when there are near-duplicates.
