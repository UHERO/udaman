# County Gaps — Classified Review

Review of the parse audit's COUNTY GAPS section (78 gaps, re-scanned against prod
after the 2026-08 re-parse). Counties: 1=Oahu/Honolulu, 2=Maui, 3=Big Island/Hawaii,
4=Kauai. Where counties label the same concept differently, we defer to Honolulu
naming. Every claim carries at least one TMK so the source profile can be inspected
on qPublic directly.

Verdict codes: **(a)** legitimate — county doesn't publish it · **(b)** missed
mapping — same concept, different label · **(c)** bug — data lost/misfiled in the
pipeline.

---

## A. Legitimate gaps — no action (~60 of 78)

### Assessments (all 11 gaps)
Each county's valuation grid headers map 1:1 onto schema columns; the gaps mirror
what each county publishes. Verified per-county header censuses:

| Claim | Example TMK |
|---|---|
| Oahu is the only county with land/building splits of exemptions and net-taxable (12-col grid) | 1-3-3-038-040-0000 |
| Maui: market land + agricultural land + single assessed "Building Value" (9-col) | 2-4-2-004-028-0000 |
| Big Island is the only county splitting *market* value by component (11-col) | 3-8-1-007-017-0000 |
| Kauai publishes totals only — "Land Value" appears 0 times on the page (6-col) | 4-3-2-001-007-0001 |

### Appeals
| Claim | Example TMK |
|---|---|
| Oahu appeal table has exactly 4 columns (Year, Appeal Type/Value, Hearing Date, Status) | 1-1-1-003-024-0000 |
| Kauai likewise 4 columns | 4-1-1-001-001-0000 |
| Maui adds Date Settled, Final Value, and 3 taxpayer-opinion columns | 2-1-2-003-005-0000 |
| Big Island publishes no appeals section at all (0 rows corpus-wide) | 3-8-1-007-017-0000 |

### Sales
| Claim | Example TMK |
|---|---|
| `valid_sale` — no validity column on Big Island or Kauai headers | 3-8-1-007-017-0000, 4-3-2-001-007-0001 |
| `book_page` — Maui records via Land Court track only (Land Court # / Land Court Cert) | 2-4-2-004-028-0000 |
| `conveyance_tax` — verbatim header on Big Island AND Kauai (schema comment stale, see E) | 3-6-1-001-002-0000, 4-1-1-001-001-0000 |

### Historical tax
| Claim | Example TMK |
|---|---|
| Kauai's "missing" `amount_due` is a footable layout spacer — `<td>&nbsp;</td>`, not a data column | 4-3-2-001-007-0001, 4-1-1-001-001-0000 |
| Big Island renders no tax-credit nested tables; relief is via exemptions (details corpus has exactly 3 description values, none credit-like) | 3-8-1-007-017-0000 |

### Residential improvements (all 15 gaps)
| Claim | Example TMK |
|---|---|
| Oahu publishes 9 labels total; no materials/quality attributes (no exterior wall, roof, fireplace, grade, heating) | 1-3-3-038-040-0000 |
| Kauai publishes 8 labels total; no framing/construction field of any kind | 4-3-2-001-007-0001 |
| Big Island: no condo grid; unit pages carry only `Condo Name`, all unit attributes empty (23/23 sampled) | 3-7-6-002-020-0001 |
| Maui condo units carry Condo Name/Unit/Floor/Type/View (no Style) | 2-1-4-003-058-0005 |
| Oahu condo units carry Style/Floor Level/View/Parking | 1-2-6-002-014-0017 |
| `building_value` per building is Maui-only; elsewhere parcel-level in assessments | 2-4-2-004-028-0000 |
| `total_room_count` is Big Island-only | 3-8-1-007-017-0000 |

### Parcel information / owners
| Claim | Example TMK |
|---|---|
| Honolulu renders no Neighborhood Code (only a "Search Sales by Neighborhood" button) | 1-3-3-038-040-0000 |
| Honolulu renders no Zoning; Big Island refers zoning to county GIS inside its Property Class value ("For Zoning information, please go to…") | 1-3-3-038-040-0000, 3-8-1-007-017-0000 |
| `parcel_note` is Maui-only ("Non taxable") | 2-4-2-004-028-0000 |
| Hazard trio `damage`/`reentry_zone`/`zone_color` is a Maui-only untitled module (Lahaina fire); blank on unaffected parcels, filled on burn-zone parcels | filled: 2-2-3-006-009-0000 (`Major 823`); blank: 2-4-2-004-028-0000 |
| `living_units` is Kauai-only (schema comment saying Big Island is wrong, see E) | 4-3-2-001-007-0001 |
| Maui has no Map section at all (no imgMap, no RenderMap) — only a "View Map" link, which is a viewer page not an image URL | 2-4-2-004-028-0000 |
| Honolulu withholds owner addresses entirely: no Owner Address grid column, no Mailing Address block | 1-3-3-038-040-0000 (compare 2-1-1-003-053-0000) |

### Yard improvements
| Claim | Example TMK |
|---|---|
| Oahu yard grid is 4 columns (Description, Quantity, Year Built, Area) — no value, no building number, no percent complete | 1-2-6-001-012-0000 |
| Big Island adds a 5th column, verbatim "Gross Building Value" → alias to `value` works (100% fill) | 3-8-1-007-017-0000 |
| Maui-only: `building_number`, packed `Dimensions/Units` cell → `dimensions` | 2-2-2-005-093-0000 |

### Commercial improvements — the template split
qPublic uses two genuinely different commercial report templates: Oahu + Big Island
share one (Building Card, Improvement Name, Property Class, Structure Type, Units,
Identical Units, Gross Building Description), Maui + Kauai share the other (Building
Type, Building Square Footage, Percent Complete, and Maui-only Value). The
1,3-vs-2,4 fill pattern is the template split, not a parser artifact.

| Claim | Example TMK |
|---|---|
| Oahu template block | 1-8-4-002-005-0000 |
| Maui template block (incl. Value) | 2-1-1-002-009-0000, 2-4-2-004-028-0000 |
| Big Island uses the Oahu template (fill pattern byte-identical) | 3-2-6-002-007-0000 |
| Kauai uses the Maui template minus Value (no Value label on page) | 4-1-1-001-001-0000 |
| Maui floor-detail table has no Card column (verbatim thead starts at Section) | 2-1-1-002-009-0000 |
| `gross_building_description` (Oahu) is free-text extras ("1 PKG", "PARKING STALLS") — NOT the same as Maui's integer `building_square_footage` | 1-8-4-002-005-0000 |

### Agricultural assessments
| Claim | Example TMK |
|---|---|
| Oahu `agricultural_type` is a dedication/ratio code ("Z56-1%", "10Y-1%") — distinct concept, don't merge | 1-3-4-021-001-0001 |
| Kauai publishes no ag module at all (absent from both rendered sections and the no-data module list) | 4-3-2-001-007-0001 |

---

## B. Missed mappings — real data recoverable (5)

| # | Mapping | Evidence | Example TMK | Rows gained |
|---|---|---|---|---|
| B1 | Kauai commercial `Structure` → `structure_type` | Values are structure class codes ("344-WHSE MM AV", "232-COMM C-2") — same vocabulary as Oahu structure_type ("WAREHOUSE MET/MAS/AVG", "COMMERCIAL C-2"). Parser drops the label entirely | 4-1-2-002-042-0000 (`344-WHSE MM AV`), 4-1-2-002-005-0000 (`633-NO COST`) | ~2,100 |
| B2 | Maui/Kauai commercial `Building Type` → `improvement_name` | Values are building proper names, not types: "GRAND WAILEA", "KAUAI MARRIOT", "CENTURY SQUARE" (Oahu improvement_name). Keep building_type populated too (non-destructive copy) | 2-2-1-008-109-0000 (GRAND WAILEA) vs 1-2-1-010-046-0001 (CENTURY SQUARE) | 4,379 |
| B3 | Maui ag `acres` → `acres_in_production` | Same concept: acreage per use-class row | 2-1-1-001-022-0000 (PASTUR 64.3 ac) vs 3-1-1-002-014-0000 | 6,317 |
| B4 | Maui ag `assessed_value` → `agricultural_value` | Same concept: discounted ag-use value per row ($1,182 for 64 ac pasture) | 2-1-1-001-022-0000 vs 3-1-1-002-014-0000 ($500) | 6,317 |
| B5 | Maui ag `description` → `use_description` | Same taxonomy: "PASTUR B 10YR" ↔ "GOOD PASTURE, 10 YR. DED.", "HOME SITE" ↔ "HOMESITE" | 2-1-1-001-022-0000 vs 3-1-1-002-014-0000 (HOMESITE) | 6,317 |

---

## C. Bugs — data lost or misfiled (4)

| # | Bug | Detail | Example TMK |
|---|---|---|---|
| C1 | GROSS BUILDING VALUE summary rows misfiled | 4,033 yard rows (Oahu 3,213 / BI 783 / Kauai 37) carry a DOLLAR amount in `area` (sq-ft column) with `value` NULL. Fix: SECTION_ROW_TRANSFORMS entry moving area→value on `description='GROSS BUILDING VALUE'` | 1-1-1-002-002-0000 (area=11,091,000 "sq ft" = $11M) |
| C2 | `sales.document_type` dead + Big Island clobber | Column never written (0/3.29M): parser folds Document Type into instrument_description. BI has BOTH headers → last-wins lets blank Document Type null a real description | 3-8-1-007-017-0000 |
| C3 | Maui `Building Class` parsed then discarded | The only real construction descriptor any county publishes ("Reinforced Concrete Frame s1 p6"); Oahu exterior_wall is 99.99% constant "DEFAULT WALLS". Home: existing empty `commercial_improvement_details.construction`. (`Rank` needs keep/drop call) | 2-1-1-002-009-0000, 2-4-2-004-028-0000 |
| C4 | Maui `dgOtherFeatures` grid unparsed | Headers: Section, Structure, Measure 1, Measure 2, Stops (parking enclosures, elevators). Parser selects only dgFloorDetails. Needs decision: new detail table, or drop knowingly | 2-4-2-004-028-0000 ("Beneath Building Parking Enclo", 24,837) |

---

## D. Fields with no home — decisions needed (2)

| # | Field | Detail | Example TMK |
|---|---|---|---|
| D1 | Maui condo `Unit Number` | Parsed as condo_unit_number, then dropped — no column. Maui TMK CPR suffix does NOT encode the unit, so this is the only unit designation ("B105") | 2-1-4-003-058-0005 |
| D2 | `Condo Type` vs `Condo Style` collision | Maui Condo Type ("Corner" = unit position) is stored INTO condo_style, which on Oahu means building form ("Highrise"). One column, two variables — statewide frequencies misleading. Proposal: separate condo_type column | 2-1-4-003-058-0005 (Corner) vs 1-2-6-002-014-0017 (Highrise) |

---

## E. Stale docs, comments, hardening, cleanup

**Comment/dictionary fixes**
- `living_units` comment says Big Island → is **Kauai** (4-3-2-001-007-0001)
- `conveyance_tax` comment says Kauai → is **Big Island + Kauai**; BI has 5.4× Kauai's volume (536,931 vs 100,133 rows)
- Yard `value` comment + FIELD_ALIASES doc say Oahu+Hawaii head it "Gross Building Value" → only **Hawaii County** does; Oahu's current template has no value column (1-2-6-001-012-0000)
- Assessments dictionary entries lack county-applicability notes (unlike properties)
- Maui's bare "Building Value" (assessments) = assessed, not market — worth a note
- Maui `Valid Sale or Other Reason` conflates flag + rejection reason ("Leasehold unadj") vs Oahu's bare flag — dictionary note
- Kauai commercial `percent_complete` (2,139/2,142 zeros) and `building_square_footage` (MIN=MAX=0) are rendered-but-never-filled — dictionary note
- Oahu commercial `exterior_wall` is 23,462/23,463 the constant "DEFAULT WALLS" — informationally empty, dictionary note

**Cheap hardening (latent, zero hits in 2026-1, but fixture-proven page variants)**
- `parseParcelInformation` is `<th>`-only; older template serves `<td><strong>` (fixtures 3-8-1-007-017-0000, 2-4-2-004-028-0000 parse to NULL parcel fields). Building parsers already handle both shapes
- Residential parser matches only "Percent Complete"; commercial accepts "% Complete" too — align
- `map_url` can capture the ajax loading spinner (`ajax-loader-small.gif`) on pages saved before map JS settles — add a guard

**Drop candidates**
- `commercial_improvement_details`: condo_style, condo_type, condo_unit, floor_level, view, project, description — never written by anything (keep `construction` for C3)
- `commercial_improvements.structure` — redundant once B1 maps Kauai's Structure → structure_type
- `sales.document_type` — if C2 resolves by folding (Maui/Kauai) + BI clobber fix, the column can go
- Migration `2026-05-22-residential-improvements-numeric-fields.sql` contradicts current schema types (declares VARCHAR for now-numeric columns) — retire

**Useful artifact noted**: the `nodata-modulelist` div ("No data available for the
following modules: …") enumerates modules a county's template HAS but the parcel
doesn't fill — cleanly separates "county doesn't publish" from "parcel has none".
Not currently exploited; could make future audits deterministic.
