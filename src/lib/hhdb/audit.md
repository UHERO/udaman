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

{"level":30,"time":1786734100901,"pid":474876,"hostname":"canoes","name":"qpub-parse-audit","period":"2026-1","msg":"Enumerating 2026-1 on the NAS to pick a sample — this takes a few minutes"}
{"level":30,"time":1786734204454,"pid":474876,"hostname":"canoes","name":"qpub-parse-audit","files":600375,"sample":400,"msg":"Sampling 400 of 600,375 pages"}

─── section coverage (395 pages sampled from 2026-1) ───

Parse audit: 1 empty tables, 8 dead columns, 75 county gaps, 24 numeric strings, 6 identity collisions

{"level":30,"time":1786734218187,"pid":474876,"hostname":"canoes","name":"qpub-parse-audit","issues":114,"msg":"Parse audit: 1 empty tables, 8 dead columns, 75 county gaps, 24 numeric strings, 6 identity collisions"}
{"level":30,"time":1786734218187,"pid":474876,"hostname":"canoes","name":"qpub-cli","msg":"Parse audit: 1 empty tables, 8 dead columns, 75 county gaps, 24 numeric strings, 6 identity collisions"}