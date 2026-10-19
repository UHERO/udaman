# Kauai dashboard: analysis and REST API coverage

Source: `tmp/kauai`, a 2014 Jekyll + CoffeeScript + d3 v3 prototype. The target is a custom data portal at `src/app/data/kauai`, built alongside `dvw` and `dbedt`, with data from the v1 REST API (`api.uhero.hawaii.edu/v1`, universe `uhero`).

The API was checked on 2026-10-16 with `GET /series?u=uhero&name=<NAME>.<F>&expand=raw` for every series × frequency the dashboard uses. A missing series returns `{"series":{"id":0,...}}`. Restricted flags and candidate replacements were confirmed in the local `uhero_db_dev` copy.

## 1. How the dashboard works

### Data model
- Each category has its own `data/<slug>_meta.json` (`series_groups[] → series_list[] → children[]`) and `data/<slug>_{a,q,m}.csv` (columns are `NAME@GEO.F`).
- Per series: `display_name`, optional `axis_name` (a shorter chart label), `udaman_name`, `a|q|m` availability flags, `units`, an optional `scale_factor` (0.001 to turn $ into $Thou or $Thou into $Mil), and `children_sum` (shown as a "parent" row).
- Values computed on the client (`data_load.coffee`):
  - YoY % change: offset 1/4/12 by frequency.
  - YTD sum and YTD % change.
  - Peak, trough, and last non-null observation.

### Page layout (every category)
1. **Nav bar**: six category tabs.
2. **Dashboard row**:
   - Left: the main time-series chart with a **range slider** under it.
   - Right: an optional "time-slice" chart with a **single-date slider**.
   - When a page has no slice chart, the line chart takes the full width.
3. **Data table**:
   - Collapsible group headers, with one level of child rows that can also collapse.
   - Each row has five parts:
     - The label and units.
     - A **sparkline**: a line with a 10% area fill over the range-slider window.
     - A **Compare** checkbox.
     - The **last observation, its date, and YTD %Chg**, at the range slider's right edge.
     - **Five period columns** (value + YoY %) ending at the date on the single-date slider. Positive changes are green, negative red.
   - Clicking a row makes it the primary series in the chart.
4. **Controls**:
   - A frequency toggle (A | Q | M). Frequencies a page doesn't have are hidden.
   - **Reset**.
   - **Export**, which downloads a static `export_data/<slug>_<f>_export.csv`.
5. **Footnotes** (each page shows its own) and a **data-source line** for each page.

### Sliders
- The **range slider** sets the date window for three things: the main chart, the sparklines, and the "Last obs / YTD" column. When a series is selected, the window snaps to that series' first non-null observation.
- The **single-date slider** sets two things: the slice chart's date and the table's five period columns. Its range is clamped to the dates that all of the sliced series share.

## 2. Chart types

| # | Chart | Where | Behavior |
|---|---|---|---|
| 1 | **Level line + YoY bars** (dual axis) | Main chart, all pages | Left axis: level line of the primary series, labeled `axis_name (units)`. Right axis: YoY % change as thin gray bars. Default mode (`line_bar`). |
| 2 | **Two-line comparison** (dual axis) | Main chart, after ticking "Compare" on a second row | Bars are hidden. The primary series stays on the left axis and the compared series is a line on the right axis. Only one compared series at a time; unticking returns to chart 1. |
| 3 | **Clustered bar chart** of YoY growth | Major Indicators slice panel | Three series: Real Personal Income, Total Visitor Days, Total Non-farm Payrolls. Covers the five periods ending at the selected date. The y-axis is fixed at ±20% and bars are clamped to it. Includes a legend. |
| 4 | **Pie chart** | Visitor Industry slice panel | Total visitor arrivals split by market (US West, US East, Japan, Other) at the selected date. The largest slice is labeled with its value, and hovering a slice shows its label. |
| 5 | **Treemap** (nested, `sticky`) | Labor Market slice panel | Nonfarm jobs hierarchy (up to 3 levels) at the selected date. Area = jobs, color = top-level sector. Tooltip shows jobs and YoY %. Leaves are summed, so parent values are never read. |
| 6 | **Sparkline** (line + area) | Every table row | Uses the range-slider window and has its own y-scale (min to max of the visible window). |

Slice panel per page (`viz.coffee` `render_page`):
- Major: clustered bars.
- Visitor: pie.
- Labor: treemap.
- Personal Income, Construction, and County Budget: no slice panel, so the line chart is full width. Income and County Budget have one turned off explicitly, and Construction gets none because its first series has no children.

Colors:
- UHERO teal `#03627f`.
- A 5-step and a 10-step teal ramp for the pie and treemap.
- A 3-step ramp for the clustered bars.
- Neon green `#ecffc7` for the active tab and hover.

## 3. Categories

| Category (slug) | Default freq | Freqs offered | Slice chart | Groups | Footnote / sources |
|---|---|---|---|---|---|
| Major Indicators (`major`) | A | A only (Q and M hidden) | Clustered YoY bars | Jobs; Income; Visitors; Construction and Housing | DLIR, BEA, BLS, Census, HTA, DBEDT |
| Visitor Industry (`vis`) | Q | A, Q, M | Pie (arrivals by market) | Visitor Arrivals (with 4 children); Visitor Census; Visitor Expenditures | HTA, Hospitality Advisors |
| Labor Market (`jobs`) | Q | A, Q, M | Treemap (nonfarm jobs) | Labor Overview; Total Nonfarm Jobs (3-level tree) | DLIR |
| Personal Income (`income`) | A | A only | none | Personal Income (Real PI with 5 components; Population; Per-capita) | BEA, BLS, Census |
| Construction (`const`) | A | A, Q | none | Construction Activity; Home Resales; Construction Costs and Affordability | Affordability-index footnote; DLIR, HBR, Locations, DBEDT, UHERO |
| County Budget (`county_rev`) | A | A only | none | County Government Revenues (Total with 7 children); Expenditures (Total with 9 children) | "May not sum to total" footnote; County of Kauai CAFR |

All pages share one footnote: "%CHG = change from same period of previous year".

Quirks to keep in mind for the rebuild:
- The table only flattens **one** child level. Grandchildren in the jobs tree appear only in the treemap, never as table rows. Those grandchildren are:
  - E_TU and E_TRADE (under E_TTU).
  - ERT and EWT (under E_TRADE).
  - EAFAC and EAFFD (under EAF).
- `ECT@KAU` is listed as monthly on Major but as Q/A only on Construction.
- Units and real-dollar base years in the meta files are hard-coded and stale. Examples:
  - "2013 $Mil" for income.
  - "1992 $Mil" for permits.
- Take labels, units, and decimals from the API's series metadata instead.
- The `scale_factor` values existed because the CSVs held raw dollars. Work them out again from the API's `unitsLabel` and don't copy them over.

## 4. Series sources and replacements

The dashboard uses **74 unique series**. Each one now maps to an existing udaman series:
- **45 are unchanged** and public in `/v1`.
- **24 are renamed.** Of these, 22 are public in `/v1` and 2 are restricted (`YPC_R`, `YL_NF_R`).
- **5 are kept** but are restricted (`KPPRVRSD_R`, `E_TTU`, `E_PBS`, `E_EDHC`, `RNS`).

In total, **7 series are restricted** and will not come back from the public `/v1` API. They were verified against the local `uhero_db_dev` copy on 2026-10-16. They are served by the unrestricted API at **`https://api.uhero.hawaii.edu/v1.u`** (same token and routes as `/v1`). The dashboard fetches every series from `/v1.u` (`src/actions/data-portal/kauai.ts`; base URL `REST_API_V1U_URL`, else `REST_API_V1_URL` + `.u`).

### a) Personal income: `_RCY` → `_R` (1982–84 dollars, 1969–2024)

| Dashboard | Use | Restricted | DB units |
|---|---|---|---|
| `Y_RCY@KAU.A` | `Y_R@KAU.A` | no | Millions of 1982-84 $ |
| `YPC_RCY@KAU.A` | `YPC_R@KAU.A` | **yes** | Thousands of 1982-84 $ |
| `YLAGFA_RCY@KAU.A` | `YLAGFA_R@KAU.A` | no | Millions of 1982-84 $ |
| `YL_NF_RCY@KAU.A` | `YL_NF_R@KAU.A` | **yes** | Millions of 1982-84 $ |
| `YSOCSEC_RCY@KAU.A` | `YSOCSEC_R@KAU.A` | no | Millions of 1982-84 $ |
| `YDIV_RCY@KAU.A` | `YDIV_R@KAU.A` | no | Millions of 1982-84 $ |
| `YTRNSF_RCY@KAU.A` | `YTRNSF_R@KAU.A` | no | Millions of 1982-84 $ |

The old meta labelled these "2013 $" and applied `scale_factor: 0.001`. The `_R` series are already in $Mil and $Thou, so no scale factor is needed.

### b) Restricted, used as-is

| Series | Freqs | Range in DB | Units |
|---|---|---|---|
| `KPPRVRSD_R@KAU` | A, Q | 1989 – 2025Q4 | Millions of 1992 $ |
| `E_TTU@KAU` | A, Q, M | 1972 – 2026-06 | Thousands |
| `E_PBS@KAU` | A, Q, M | 1990 – 2026-06 | Thousands |
| `E_EDHC@KAU` | A, Q, M | 1990 – 2026-06 | Thousands |
| `RNS@KAU.A` (total county revenues) | A | 1979 – 2020 | Thousands of current $ |

### c) County budget: `…NS` → no-suffix series (all end FY2020; to be updated in udaman)

The `…NS` names exist but are restricted and **hold no data**. The no-suffix twins are public, run 1979–2020, and are in thousands of current dollars. The exception is total revenues: it has no public twin, so it stays `RNS@KAU.A` (restricted).

| Dashboard | Use |
|---|---|
| `RNS@KAU.A` | `RNS@KAU.A` (restricted, see b) |
| `RTNS@KAU.A` | `RT@KAU.A` |
| `ROLCNNS@KAU.A` | `ROLCN@KAU.A` |
| `RORENNS@KAU.A` | `ROREN@KAU.A` |
| `ROINTNS@KAU.A` | `ROINT@KAU.A` (named "Investment Earnings" in udaman) |
| `ROITGNS@KAU.A` | `ROITG@KAU.A` |
| `ROCHGNS@KAU.A` | `ROCHG@KAU.A` |
| `ROMISNS@KAU.A` | `ROMIS@KAU.A` |
| `GNS@KAU.A` | `G@KAU.A` |
| `GGNGNS@KAU.A` | `GGNG@KAU.A` |
| `GPSFNS@KAU.A` | `GPSF@KAU.A` |
| `GPWKNS@KAU.A` | `GPWK@KAU.A` |
| `GHWYNS@KAU.A` | `GHWY@KAU.A` |
| `GSANNS@KAU.A` | `GSAN@KAU.A` |
| `GCULNS@KAU.A` | `GCUL@KAU.A` |
| `GPWFNS@KAU.A` | `GPWF@KAU.A` |
| `GCAPNS@KAU.A` | `GCAP@KAU.A` |
| `GDEBNS@KAU.A` | `GDEB@KAU.A` |

The old meta applied `scale_factor: 0.001` and labelled the units "$Thou". The data is already in thousands, so drop the scale factor (or use 0.001 to show $Mil).

### Other things to check
- **County budget** stops at FY2020. The user is updating it in udaman.
- **`HAI@KAU` and `HAICON@KAU`** end in 2024. They are annual only.
- **`EFI@KAU` and `ERE@KAU`** have Q/M data that ends 2025-10 / 2025-12, two quarters behind the other jobs series.
- **Unused frequencies.** Some series have frequencies in `/v1` that the dashboard doesn't use:
  - `PRM`, `OCUP%`, `PMKRSGF`, and `PMKRCON` have monthly data (M).
  - `NR` has quarterly data (Q).

## 5. Full inventory

The arrow (↳) marks how deep the series sits in the meta tree. Source: **v1** = public API; **restricted** = only in `/v1.u`. Range comes from the API for public series and from the local DB for restricted ones.

### major

| Dashboard series | Display name | Freqs | Use | Source | Range |
|---|---|---|---|---|---|
| `E_NF@KAU` | Total Non-farm Payrolls | AQM | same | v1 | 1972–2025-01 |
| `UR@KAU` | Unemployment Rate | AQM | same | v1 | 1990–2025-01 |
| `Y_RCY@KAU` | Real Personal Income | A | `Y_R@KAU` | v1 | 1969–2024 |
| `NR@KAU` | Population | A | same | v1 | 1959–2025-01 |
| `YPC_RCY@KAU` | Real Per-Capita Personal Income | A | `YPC_R@KAU` | restricted | 1969–2024 |
| `VIS@KAU` | Total Visitor Arrivals | AQM | same | v1 | 1990–2025-01 |
| `VDAY@KAU` | Total Visitor Days | AQM | same | v1 | 1992–2025-01 |
| `PMKRSGF@KAU` | Median Resale Price for Single-Family Home | AQ | same | v1 | 1994–2025-01 |
| `KPPRVRSD_R@KAU` | Real Residential Building Permits | AQ | same | restricted | 1989–2025-10 |
| `ECT@KAU` | Construction Jobs | AQM | same | v1 | 1972–2025-01 |

### vis

| Dashboard series | Display name | Freqs | Use | Source | Range |
|---|---|---|---|---|---|
| `VIS@KAU` | Total Visitor Arrivals | AQM | same | v1 | 1990–2025-01 |
| ↳ `VISUSW@KAU` | US West Visitor Arrivals | AQM | same | v1 | 1990–2025-01 |
| ↳ `VISUSE@KAU` | US East Visitor Arrivals | AQM | same | v1 | 1990–2025-01 |
| ↳ `VISJP@KAU` | Japan Visitor Arrivals | AQM | same | v1 | 1990–2025-01 |
| ↳ `VISRES@KAU` | Other Visitor Arrivals | AQM | same | v1 | 1990–2025-01 |
| `VLOS@KAU` | Length of Stay | AQM | same | v1 | 1992–2025-01 |
| `VDAY@KAU` | Visitor Days | AQM | same | v1 | 1992–2025-01 |
| `PRM@KAU` | Average Daily Room Rate | AQ | same | v1 | 1989–2025-01 |
| `OCUP%@KAU` | Hotel Occupancy Rate | AQ | same | v1 | 1989–2025-01 |
| `VEXP@KAU` | Total Visitor Expenditures | AQM | same | v1 | 2003–2025-01 |

### jobs

| Dashboard series | Display name | Freqs | Use | Source | Range |
|---|---|---|---|---|---|
| `EMPL@KAU` | Employment | AQM | same | v1 | 1990–2025-01 |
| `UR@KAU` | Unemployment Rate | AQM | same | v1 | 1990–2025-01 |
| `E_NF@KAU` | Total Nonfarm Jobs | AQM | same | v1 | 1972–2025-01 |
| ↳ `ECT@KAU` | Construction & Mining | AQM | same | v1 | 1972–2025-01 |
| ↳ `EMN@KAU` | Manufacturing | AQM | same | v1 | 1972–2025-01 |
| ↳ `E_TTU@KAU` | Trade, Transport, & Utility | AQM | same | restricted | 1972–2026-06 |
| ↳ ↳ `E_TU@KAU` | Transportation & Utilities | AQM | same | v1 | 1972–2025-01 |
| ↳ ↳ `E_TRADE@KAU` | Total Trade Jobs | AQM | same | v1 | 1990–2025-01 |
| ↳ ↳ ↳ `ERT@KAU` | Retail Trade Jobs | AQM | same | v1 | 1990–2025-01 |
| ↳ ↳ ↳ `EWT@KAU` | Wholesale Trade Jobs | AQM | same | v1 | 1990–2025-01 |
| ↳ `EIF@KAU` | Information Jobs | AQM | same | v1 | 1990–2025-01 |
| ↳ `E_FIR@KAU` | Financial Activities | AQM | same | v1 | 1972–2025-01 |
| ↳ ↳ `EFI@KAU` | Finance and Insurance Jobs | AQM | same | v1 | 1972–2025-01 |
| ↳ ↳ `ERE@KAU` | Real Estate & Rental Jobs | AQM | same | v1 | 1972–2025-01 |
| ↳ `E_PBS@KAU` | Professional & Bus Services | AQM | same | restricted | 1990–2026-06 |
| ↳ ↳ `EPS@KAU` | Prof, Sci, and Tech Svc Jobs | AQM | same | v1 | 1990–2025-01 |
| ↳ ↳ `EMA@KAU` | Mgmt of Companies Jobs | AQM | same | v1 | 1990–2025-01 |
| ↳ ↳ `EAD@KAU` | Admin & Waste Management | AQM | same | v1 | 1990–2025-01 |
| ↳ `E_EDHC@KAU` | Educational & Health Svs | AQM | same | restricted | 1990–2026-06 |
| ↳ ↳ `EED@KAU` | Educational Services | AQM | same | v1 | 1990–2025-01 |
| ↳ ↳ `EHC@KAU` | Healthcare & Social Asst | AQM | same | v1 | 1972–2025-01 |
| ↳ `E_LH@KAU` | Leisure & Hospitality | AQM | same | v1 | 1990–2025-01 |
| ↳ ↳ `EAE@KAU` | Arts, Entertain., & Recreation | AQM | same | v1 | 1990–2025-01 |
| ↳ ↳ `EAF@KAU` | Accom & Food Services | AQM | same | v1 | 1972–2025-01 |
| ↳ ↳ ↳ `EAFAC@KAU` | Accomodation Jobs | AQM | same | v1 | 1972–2025-01 |
| ↳ ↳ ↳ `EAFFD@KAU` | Food Svc. & Drinking Place Jobs | AQM | same | v1 | 1972–2025-01 |
| ↳ `EOS@KAU` | Other service jobs | AQM | same | v1 | 1990–2025-01 |
| ↳ `EGV@KAU` | Total Government Jobs | AQM | same | v1 | 1972–2025-01 |
| ↳ ↳ `EGVFD@KAU` | Federal Government Jobs | AQM | same | v1 | 1972–2025-01 |
| ↳ ↳ `E_GVSL@KAU` | State & Local Government Jobs | AQM | same | v1 | 1972–2025-01 |

### income

| Dashboard series | Display name | Freqs | Use | Source | Range |
|---|---|---|---|---|---|
| `Y_RCY@KAU` | Real Personal Income | A | `Y_R@KAU` | v1 | 1969–2024 |
| ↳ `YLAGFA_RCY@KAU` | Real Farm Earnings | A | `YLAGFA_R@KAU` | v1 | 1969–2024 |
| ↳ `YL_NF_RCY@KAU` | Real Nonfarm Earnings | A | `YL_NF_R@KAU` | restricted | 1969–2024 |
| ↳ `YSOCSEC_RCY@KAU` | Real Social Security Taxes | A | `YSOCSEC_R@KAU` | v1 | 1969–2024 |
| ↳ `YDIV_RCY@KAU` | Real Dividends, Interest and Rent | A | `YDIV_R@KAU` | v1 | 1969–2024 |
| ↳ `YTRNSF_RCY@KAU` | Real Transfer Payments | A | `YTRNSF_R@KAU` | v1 | 1969–2024 |
| `NR@KAU` | Resident Population | A | same | v1 | 1959–2025-01 |
| `YPC_RCY@KAU` | Real Per Capita Income | A | `YPC_R@KAU` | restricted | 1969–2024 |

### const

| Dashboard series | Display name | Freqs | Use | Source | Range |
|---|---|---|---|---|---|
| `ECT@KAU` | Construction Jobs | AQ | same | v1 | 1972–2025-01 |
| `KPPRVRSD_R@KAU` | Real Residential Building Permits | AQ | same | restricted | 1989–2025-10 |
| `PMKRSGF@KAU` | Median Resale Price for Single-Family Home | AQ | same | v1 | 1994–2025-01 |
| `PMKRCON@KAU` | Median Resale Price for Condominium | AQ | same | v1 | 1994–2025-01 |
| `KRSGF@KAU` | Number of Resales for Single-Family Home | AQ | same | v1 | 1980–2025-01 |
| `KRCON@KAU` | Number of Resales for Condominium | AQ | same | v1 | 1980–2025-01 |
| `PICTSGF@HON` | Honolulu Construction Cost Index | AQ | same | v1 | 1982–2025-01 |
| `HAI@KAU` | Housing Affordability, Single-family home | A | same | v1 | 1994–2024-01 |
| `HAICON@KAU` | Housing Affordability, Condominium | A | same | v1 | 1994–2024-01 |

### county_rev

| Dashboard series | Display name | Freqs | Use | Source | Range |
|---|---|---|---|---|---|
| `RNS@KAU` | Total | A | same | restricted | 1979–2020 |
| ↳ `RTNS@KAU` | Taxes (excluding TAT) | A | `RT@KAU` | v1 | 1979–2020 |
| ↳ `ROLCNNS@KAU` | Licenses and Permits | A | `ROLCN@KAU` | v1 | 1979–2020 |
| ↳ `RORENNS@KAU` | Rents and Concessions | A | `ROREN@KAU` | v1 | 1979–2020 |
| ↳ `ROINTNS@KAU` | Interest | A | `ROINT@KAU` | v1 | 1979–2020 |
| ↳ `ROITGNS@KAU` | Intergov Revenue (including TAT) | A | `ROITG@KAU` | v1 | 1979–2020 |
| ↳ `ROCHGNS@KAU` | Charges for Current Services | A | `ROCHG@KAU` | v1 | 1979–2020 |
| ↳ `ROMISNS@KAU` | Miscellaneous | A | `ROMIS@KAU` | v1 | 1979–2020 |
| `GNS@KAU` | Total | A | `G@KAU` | v1 | 1979–2020 |
| ↳ `GGNGNS@KAU` | General Government | A | `GGNG@KAU` | v1 | 1979–2020 |
| ↳ `GPSFNS@KAU` | Public Safety | A | `GPSF@KAU` | v1 | 1979–2020 |
| ↳ `GPWKNS@KAU` | Public Works | A | `GPWK@KAU` | v1 | 1979–2020 |
| ↳ `GHWYNS@KAU` | Highways and Streets | A | `GHWY@KAU` | v1 | 1979–2020 |
| ↳ `GSANNS@KAU` | Sanitation | A | `GSAN@KAU` | v1 | 1979–2020 |
| ↳ `GCULNS@KAU` | Culture and Recreation | A | `GCUL@KAU` | v1 | 1979–2020 |
| ↳ `GPWFNS@KAU` | Public Welfare | A | `GPWF@KAU` | v1 | 1979–2020 |
| ↳ `GCAPNS@KAU` | Capital Outlay | A | `GCAP@KAU` | v1 | 1979–2020 |
| ↳ `GDEBNS@KAU` | Debt Service | A | `GDEB@KAU` | v1 | 1979–2020 |
