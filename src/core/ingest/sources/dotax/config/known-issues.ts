/**
 * DOTAX file errors checked by hand against the file (started as a copy of
 * rprocess dotax_known_issues.csv). `waive` drops a matching problem
 * (detail = regex, empty = any) and records its note; `accept` lets a
 * parser use a file whose header month is wrong. series_gap details are
 * the source key type|section|sub|item|geo (the R copy keyed them by
 * UDAMAN series id). String.raw keeps the regex backslashes.
 */
export const KNOWN_ISSUES_CSV = String.raw`type,month,check,detail,action,note
fuels,2008-01,header_month,,accept,"title says JANUARY 2007; values are January 2008 (statewide TOTAL 12569039 = collec 2008-01 Fuel line exactly; January 2007 was 15691628)"
fuels,2002-04,unreadable,,waive,"04FUEL.xls in the 2002-04 zip cannot be opened by readxl (fuels series start 2002-05)"
fuels,2002-07,base_vs_allocation,,waive,"DOTAX file: allocation TOTAL is $245.78 below the base TOTAL for Maui and the state"
fuels,2008-06..2009-01,fuel_types_sum,^(HI|KAU):,waive,"DOTAX file: Kauai SUB-TOTAL exceeds its fuel-type rows by $196-$542 (2008-06, 08, 09, 10, 12, 2009-01); the statewide SUMMARY carries the same difference"
fuels,2008-06..2009-01,fuel_total,^(HI|KAU):,waive,"same Kauai SUB-TOTAL difference as fuel_types_sum, carried into TOTAL"
fuels,2026-05,no_allocation_table,,waive,"DOTAX file: the allocation table is pasted as text (several rows in one cell), so county fuel tax cannot be read for 2026-05"
fuels,2026-05,series_gap,^fuels\|alloc_total\|\|county_fuel_tax(_maui)?\|,waive,"no readable allocation table in the 2026-05 file (see no_allocation_table)"
collec,2009-07,blank_label,480983,waive,"DOTAX file: a $480,983 distribution fund row has no label"
collec,2009-07,distribution_sum,,waive,"distribution funds fall short of SUB-TOTAL by exactly the unlabeled $480,983 row"
collec,2002-06,series_gap,^collec\|distribution\|\|convention_center_fund\|HI$,waive,"the 2002-06 file has no Convention Center Fund row (2002-05 Convention Center Fund 0, 2002-07 Convention Center Enterprise Fund)"
collec,2018-01..2019-06,series_gap,"^collec\|(county_surcharge\|\|surcharge_(haw|kau)\|HI|collections\|\|county_surcharge\|(HAW|KAU))$",waive,"no county surcharge rows for Hawaii / Kauai: their surcharges started 2019-01 and collec has one combined line for 2019-01..06"
collec,2019-01..2019-06,series_gap,"^collec\|(county_surcharge\|\|surcharge_hon\|HI|collections\|\|county_surcharge\|HON)$",waive,"collec has one combined COUNTY SURCHARGES line for 2019-01..06, no county split (the State row has it)"
collec,2018-01..2023-12,series_gap,"^collec\|(county_surcharge\|\|surcharge_mau\|HI|collections\|\|county_surcharge\|MAU)$",waive,"Maui surcharge started 2024-01; before 2018 the Maui value is the collections district column"
liqtob,2012-10,header_month,,waive,"the 2012-10 zip holds the November 2012 liqtob file; county liquor / tobacco for 2012-10 come from the collec district columns"
ge,2016-03..2016-04,series_gap,"^ge\|(collections|base)\|\|(interest|all_others_4)\|",waive,"DOTAX printed one Interest & All Others row (ITO) in 2016-03/04 instead of Interest and All Others (4%)"
ge,2016-12,series_gap,"^ge\|base\|\|(all_others_4|sugar_processing|pineapple_canning)\|",waive,"the 2016-12 GE file's base table has no All Others (4%), Sugar Processing or Pineapple Canning rows (collections shows them as 0)"
collec,2021-07..2022-12,series_gap,"^collec\|distribution\|\|(natural_area_reserve_fund|tat_trust_fund)\|HI$",waive,"fund ended (0 from 2021-01); DOTAX dropped the row 2021-07..2022-12 and printed it again as 0 2023-01..2024-06"
collec,2022-07..2022-12,series_gap,^collec\|distribution\|\|tourism_special_fund\|HI$,waive,"fund ended (last non-zero 2021-06); DOTAX dropped the row 2022-07..2022-12 and printed it again as 0 2023-01..2024-06"
`;
