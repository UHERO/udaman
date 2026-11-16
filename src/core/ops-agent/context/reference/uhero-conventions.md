# UHERO catalog conventions

**Series names** are IDs, shaped `MNEMONIC@GEO.FREQ`, e.g. `VISNS@HI.M` (visitor arrivals, not seasonally adjusted, State of Hawaii, monthly). Frequencies: A annual, S semiannual, Q quarterly, M monthly, W weekly, D daily. Common geographies: HI (state), HON (Honolulu / City & County), HAW (Hawaii County), MAU (Maui County), KAU (Kauai), MAUI, MOL, LAN (islands), US, JP. Series that share the part before `@` are siblings (same measure, other geographies or frequencies). Siblings usually share source, source detail and unit, but not always.

**Measurements** group the series that are one measure across geographies and frequencies (usually one name prefix, sometimes several, e.g. the seasonally adjusted and unadjusted versions). Data lists are made of measurements, and a series appears on the portal only through a measurement in a data list. A measurement can carry its own source, source detail, unit, portal name and source link. The portal shows a series' own value and falls back to the measurement's, so a value set once on the measurement covers every series that has none.

**dataPortalName** is the label users see on the portal; it must be unique within a data list. **name** is the ID. **description** is extra context, not a label.

**Loaders** (table `data_sources`) hold a load statement (`eval`) per series. A series can have several loaders; priority decides which values win. Convention: the top loader is 100, then 90, 80, and so on. Never use more than 100.

**Load statements** are Ruby-style expressions from the original Rails app, evaluated by the TypeScript port (`src/core/catalog/utils/eval-parser.ts`, `eval-executor.ts`). Common shapes:

- `Series.load_from_download("handle@source.org", { :file_type => "xls", :sheet => "…", :row => "header:col:1:Label:prefix", :col => "…", :frequency => "M" })`: a file downloaded through a download handle; rows and columns are found by header matching.
- `Series.load_from_extract("source", { … })`: data from the ingest pipeline (raw artifacts plus extractors).
- `Series.load_api_bls("SERIESID", "M")`, `Series.load_api_bea(…)`, `Series.load_api_fred("ID", "M")`: API loaders.
- Arithmetic and transforms on other series: `"OTHER@HI.M".ts * 1000`, `.aggregate(:quarter, :average)`, `.share_using(…)`. These depend on other series; if a dependency is broken, its dependents break too.

**Dates and times**: timestamps in the database are Hawaii wall-clock time (HST, UTC-10, no DST).

TODO(economists): add the conventions reviewers most often correct (units rules, source vs source detail, when a series should have no source link).
