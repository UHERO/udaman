```
uhero@canoes:~/Developer/udaman$ bun qpub parse-audit
$ bun run src/core/workers/qpub-cli.ts parse-audit
{"level":30,"time":1786734036850,"pid":474876,"hostname":"canoes","name":"qpub-parse-audit","stagingDir":"/tmp/hhdb-extract","period":"2026-1","sample":400,"msg":"Parse audit started"}
```

─── QPub parse audit — staging /tmp/hhdb-extract ───

table                                   rows   by island 
properties                           590,129   1:323,058  2:78,964  3:148,958  4:39,149
parcels                              590,129   1:323,058  2:78,964  3:148,958  4:39,149
owners                               963,377   1:522,492  2:135,673  3:238,308  4:66,904
assessments                        7,309,641   1:3,352,349  2:852,699  3:2,632,743  4:471,850
land_classifications                 217,248   1:217,142  3:106
residential_improvements             486,072   1:297,390  2:71,660  3:84,235  4:32,787
commercial_improvements               26,575   1:15,308  2:3,979  3:5,135  4:2,153
commercial_improvement_details        40,912   1:24,804  2:6,164  3:7,698  4:2,246
sales                              3,237,043   1:1,961,428  2:426,966  3:671,836  4:176,813
permits                              768,753   1:448,456  2:72,229  3:182,814  4:65,254
current_tax_bills                    574,129   1:310,617  2:74,744  3:161,151  4:27,617
historical_tax_summary             7,175,655   1:2,954,491  2:705,210  3:3,515,954
historical_tax_details            29,077,970   1:12,181,244  2:2,762,927  3:14,133,799
historical_tax_payments           12,218,199   1:5,573,870  2:1,298,683  3:5,345,646
historical_tax_credits               368,007   1:358,818  2:9,189
condominium_projects                   7,502   1:4,546  3:1,087  4:1,869
condominium_units                    178,513   1:149,805  3:14,351  4:14,357
yard_improvements                    144,186   1:64,330  2:22,897  3:45,383  4:11,576
residential_additions              1,254,055   1:995,691  2:258,364
agricultural_assessments              28,041   1:2,429  2:6,268  3:19,344
accessory_structures                       0  
appeals                               37,736   1:20,345  2:7,599  4:9,792
dedications                           42,228   1:42,228

EMPTY TABLES  (1)
  extracted zero rows — usually a section key that never matched
    accessory_structures -- section merged with yard_improvements table

DEAD COLUMNS  (8)
  never populated in any row — no parser field resolves to them
    properties.address_other -- there was a reason for this, maybe only some properties had it.
    properties.non_taxable_status -- Kauai only, see data hhdb-data-dictionary.ts for more info
    properties.sketch_url -- urls for building skethes, low priority, but they exist in the Sketches section, might as well update the parser to get these.
    parcels.address_other -- same as properties
    parcels.non_taxable_status -- same as properties
    commercial_improvement_details.occupancy -- investigate
    historical_tax_summary.tax_details_total_payments_credits -- exists in the last row of the tax details table. May be "$0.00". 
    historical_tax_details.payments_credits -- a column in the tax details tables, needs to be parsed.

COUNTY GAPS  (75)
  populated for some counties, absent for others — check for a per-county field name
    properties.neighborhood_code: set on 2,3,4 — never on 1
    properties.zoning: set on 2,4 — never on 1,3
    properties.parcel_note: set on 2 — never on 1,3,4
    properties.damage: set on 2 — never on 1,3,4
    properties.reentry_zone: set on 2 — never on 1,3,4
    properties.zone_color: set on 2 — never on 1,3,4
    properties.living_units: set on 4 — never on 1,2,3
    properties.map_url: set on 1,3,4 — never on 2
    parcels.neighborhood_code: set on 2,3,4 — never on 1
    parcels.zoning: set on 2,4 — never on 1,3
    parcels.parcel_note: set on 2 — never on 1,3,4
    parcels.damage: set on 2 — never on 1,3,4
    parcels.reentry_zone: set on 2 — never on 1,3,4
    parcels.zone_color: set on 2 — never on 1,3,4
    parcels.living_units: set on 4 — never on 1,2,3
    owners.owner_address: set on 2,3,4 — never on 1
    assessments.assessed_land_value: set on 1,2,3 — never on 4
    assessments.assessed_building_value: set on 1,2,3 — never on 4
    assessments.dedicated_use_value: set on 1,3 — never on 2,4
    assessments.land_exemption: set on 1 — never on 2,3,4
    assessments.building_exemption: set on 1 — never on 2,3,4
    assessments.net_taxable_land_value: set on 1 — never on 2,3,4
    assessments.net_taxable_building_value: set on 1 — never on 2,3,4
    assessments.agricultural_land_value: set on 2 — never on 1,3,4
    assessments.market_land_value: set on 2,3 — never on 1,4
    assessments.market_building_value: set on 3 — never on 1,2,4
    assessments.total_market_value: set on 3,4 — never on 1,2
    residential_improvements.occupancy: set on 1 — never on 2,3,4
    residential_improvements.framing: set on 1,2,3 — never on 4
    residential_improvements.percent_complete: set on 2,4 — never on 1,3
    residential_improvements.heating_cooling: set on 2,3 — never on 1,4
    residential_improvements.exterior_wall: set on 2,3 — never on 1,4
    residential_improvements.roof_material: set on 2,3 — never on 1,4
    residential_improvements.fireplace: set on 2,3 — never on 1,4
    residential_improvements.grade: set on 2,3 — never on 1,4
    residential_improvements.building_value: set on 2 — never on 1,3,4
    residential_improvements.total_room_count: set on 3 — never on 1,2,4
    residential_improvements.condo_style: set on 1,2,4 — never on 3
    residential_improvements.condo_view: set on 1,2,4 — never on 3
    residential_improvements.floor_level: set on 1,2,4 — never on 3
    … and 35 more

NUMERIC STRINGS  (24)
  text columns holding only numbers — candidates for a numeric type
    properties.island_code (590,129 values, all numeric, max len 1)
    properties.living_units (39,149 values, all numeric, max len 3) -- convert to number
    parcels.living_units (39,149 values, all numeric, max len 3) -- convert to number
    land_classifications.square_footage (217,248 values, all numeric, max len 11) -- convert to number
    land_classifications.acreage (217,248 values, all numeric, max len 9) -- convert to number
    residential_improvements.building_number (486,072 values, all numeric, max len 4) -- convert to number
    residential_improvements.total_room_count (84,235 values, all numeric, max len 2) -- convert to number
    residential_improvements.floor_level (158,472 values, all numeric, max len 3) -- convert to number
    residential_improvements.parking_spaces (125,531 values, all numeric, max len 4) -- convert to number, has decimals
    commercial_improvements.building_card (20,443 values, all numeric, max len 4) -- convert to number
    commercial_improvements.units (20,443 values, all numeric, max len 4) -- convert to number
    commercial_improvements.identical_units (20,443 values, all numeric, max len 2) -- convert to number
    commercial_improvements.building_square_footage (6,132 values, all numeric, max len 9) -- convert to number
    commercial_improvement_details.card (34,748 values, all numeric, max len 4) -- convert to number
    commercial_improvement_details.perimeter (40,912 values, all numeric, max len 4) -- convert to number
    commercial_improvement_details.wall_height (40,912 values, all numeric, max len 2) -- convert to number
    historical_tax_payments.payment_sequence (12,218,199 values, all numeric, max len 8) -- convert to number
    yard_improvements.building_number (22,897 values, all numeric, max len 4) -- convert to number
    yard_improvements.quantity (144,186 values, all numeric, max len 5) -- convert to number
    residential_additions.card (1,254,055 values, all numeric, max len 4) -- convert to number
    residential_additions.line (1,254,055 values, all numeric, max len 2) -- convert to number
    agricultural_assessments.acres (6,268 values, all numeric, max len 9) -- convert to number
    agricultural_assessments.acres_in_production (21,773 values, all numeric, max len 9) -- convert to number
    appeals.tax_payer_opinion_of_property_class (1,062 values, all numeric, max len 2) -- would be nice to discover their number -> class mapping. Opaque as is.

IDENTITY COLLISIONS  (6)
  change detection versions these against each other and duplicates on every load
    owners: 2,873 of 963,377 rows (0.3%) share an identity with another row on the same parcel -- most owners won't change year to year, just update last_year_observed.
    land_classifications: 30,362 of 217,248 rows (14.0%) share an identity with another row on the same parcel -- like owner, unlikely to change most year, but multiple can exist for one property. should update last_year_observed
    sales: 115,406 of 3,237,043 rows (3.6%) share an identity with another row on the same parcel -- we'll rescrape many of the same old sales each year, we should just add the new records as they appear and ignore duplicates of existing years
    permits: 3 of 768,753 rows (0.0%) share an identity with another row on the same parcel -- unsure, very small number
    yard_improvements: 2,196 of 144,186 rows (1.5%) share an identity with another row on the same parcel -- Appears to have a 'quantity' field for listing actual duplicate structures, but this should not be confused with scraping the same record in subsequent years.
    appeals: 589 of 37,736 rows (1.6%) share an identity with another row on the same parcel -- investigate, appeals are likely to update the same record over time, so we may get the same appeal but with new field values in subsequent years.
    
{"level":30,"time":1786734100901,"pid":474876,"hostname":"canoes","name":"qpub-parse-audit","period":"2026-1","msg":"Enumerating 2026-1 on the NAS to pick a sample — this takes a few minutes"}
{"level":30,"time":1786734204454,"pid":474876,"hostname":"canoes","name":"qpub-parse-audit","files":600375,"sample":400,"msg":"Sampling 400 of 600,375 pages"}

─── section coverage (395 pages sampled from 2026-1) ───

UNRECOGNISED SECTIONS  (1)
  parsed but consumed by nothing — no generic mapping, no dedicated loader
    home_exemption_information  (23 pages)

Parse audit: 1 empty tables, 8 dead columns, 75 county gaps, 24 numeric strings, 6 identity collisions

{"level":30,"time":1786734218187,"pid":474876,"hostname":"canoes","name":"qpub-parse-audit","issues":114,"msg":"Parse audit: 1 empty tables, 8 dead columns, 75 county gaps, 24 numeric strings, 6 identity collisions"}
{"level":30,"time":1786734218187,"pid":474876,"hostname":"canoes","name":"qpub-cli","msg":"Parse audit: 1 empty tables, 8 dead columns, 75 county gaps, 24 numeric strings, 6 identity collisions"}