/**
 * The fixed `source` label of each DOTAX row: (type, section, sub, item)
 * → the label load statements use. Every spelling DOTAX has printed for a
 * row resolves to its item through config/labels; this table picks the
 * one label the extract prints for it, so a relabel or typo in a later
 * file stays the same series under the same name.
 *
 * Generated 2026-10-14 from the cached 2002–2026 report files (the latest
 * spelling at the time) by scripts/generate-dotax-canonical.ts. Edit by
 * hand from here on; a row missing here is a soft `new_label` failure.
 * Numbered sub-totals and TOTAL rows are named by dotaxDisplay (../labels),
 * not here.
 */

export const CANONICAL_CSV = String.raw`type,section,sub,item,source
collec,coll_total,,total,TOTAL - DECEMBER
collec,collections,,all_others,All Others
collec,collections,,banks,Banks/Financial Corp.
collec,collections,,conveyance,Conveyance
collec,collections,,county_surcharge,County Surcharges
collec,collections,,employment_security,Employment Sec. Contri.
collec,collections,,environmental,Environmental
collec,collections,,fuel,Fuel
collec,collections,,fuel_environmental,Fuel & Environmental
collec,collections,,ge_license,GE Licenses
collec,collections,,general_excise,General Excise & Use
collec,collections,,inheritance,Inheritance/Estate
collec,collections,,insurance_fees,Insurance Fees
collec,collections,,insurance_premiums,Insurance Premiums
collec,collections,,liquor,Liquor Tax and Permits
collec,collections,,motor_vehicle,Mtr. Vehicle Tax and Fees
collec,collections,,public_service,Public Service Co.
collec,collections,,rental_vehicle,Rental Vehicle Tax and Fees
collec,collections,,tat,Trans. Accomm. Tax/Time Share Occup. Tax
collec,collections,,tat_fees,Trans. Accomm./Time Share Occup. Fees
collec,collections,,tobacco,Tobacco Tax and Licenses/Permits
collec,collections,corp,corp_decl_est,Decl. of Est. Taxes
collec,collections,corp,corp_pay_returns,Payment W/ Returns
collec,collections,corp,corp_refunds,Refunds
collec,collections,ind,ind_decl_est,Decl. of Est. Taxes
collec,collections,ind,ind_pay_returns,Payment W/ Returns
collec,collections,ind,ind_refunds,Refunds
collec,collections,ind,ind_withholding,WH Tax on Wages
collec,county_revenue,,county_fuel_tax,Fuel Tax
collec,county_revenue,,county_revenue_total,OTHER COUNTY REVENUE TOTAL
collec,county_revenue,,county_tat,Trans. Accomm. Tax
collec,county_surcharge,,county_surcharges,COUNTY SURCHARGE
collec,county_surcharge,,honolulu_surcharge,HONOLULU COUNTY SURCHARGE
collec,county_surcharge,,surcharge_haw,County of Hawaii
collec,county_surcharge,,surcharge_hon,City and County of Honolulu
collec,county_surcharge,,surcharge_kau,County of Kauai
collec,county_surcharge,,surcharge_mau,County of Maui
collec,distribution,,agricultural_development_and_food_security_fund,Agricultural Development & Food Security Fund
collec,distribution,,airport_fund,State Airport Fund
collec,distribution,,boating_fund,Boating Special Fund
collec,distribution,,cancer_research_fund,Cancer Research Fund
collec,distribution,,cigarette_stamp_admin_fund,Cigarette Stamp Administrative Fund
collec,distribution,,cigarette_stamp_enforcement_fund,Cigarette Stamp Enforcement Fund
collec,distribution,,community_health_centers_fund,Community Health Centers Fund
collec,distribution,,compliance_resolution_fund,Compliance Resolution Fund
collec,distribution,,convention_center_fund,Convention Center Enterprise Fund
collec,distribution,,domestic_violence_fund,Domestic Violence/Child Abuse and Neglect Funds
collec,distribution,,election_campaign_fund,Election Campaign Fund
collec,distribution,,electric_vehicle_charging_system_subaccount,Electric Vehicle Charging System Subaccount
collec,distribution,,emergency_medical_service_fund,Emergency Medical Service Fund
collec,distribution,,employment_security_fund,Employment Security Fund
collec,distribution,,energy_security_fund,Energy Security Fund
collec,distribution,,energy_systems_development_fund,Energy Systems Development Fund
collec,distribution,,environmental_fund,Environmental Fund
collec,distribution,,general_fund,State General Fund
collec,distribution,,highway_fund,State Highway Fund
collec,distribution,,hurricane_relief_fund,Hurricane Relief Fund
collec,distribution,,hydrogen_fueling_system_subaccount,Hydrogen Fueling System Subaccount
collec,distribution,,land_and_development_fund,Land and Development Fund
collec,distribution,,land_conservation_fund,Land Conservation Fund
collec,distribution,,mass_transit_fund,Mass Transit Fund
collec,distribution,,natural_area_reserve_fund,Natural Area Reserve Fund
collec,distribution,,public_libraries_fund,Public Libraries Fund
collec,distribution,,rental_housing_fund,Rental Housing Fund
collec,distribution,,school_repairs_fund,School Minor Repairs & Maintenance Fund
collec,distribution,,subtotal,SUB-TOTAL
collec,distribution,,tat_trust_fund,TAT Trust Fund
collec,distribution,,tax_administration_fund,Tax Administration Fund
collec,distribution,,tourism_emergency_special_fund,Tourism Emergency Special Fund
collec,distribution,,tourism_special_fund,Tourism Special Fund
collec,distribution,,trauma_system_fund,Trauma System Fund
collec,distribution,,turtle_bay_conservation_easement_fund,Turtle Bay Conservation Easement Fund
collec,grand_total,,grand_total,TOTAL
fuels,alloc_amount,,agricultural_fund,Agricultural Development & Food Security Fund
fuels,alloc_amount,,airport_fund,State Airports Special Fund
fuels,alloc_amount,,boating_fund,State Boating Special Fund
fuels,alloc_amount,,county_fuel_tax,County Fuel Tax
fuels,alloc_amount,,county_fuel_tax_lanai,Island of Lanai
fuels,alloc_amount,,county_fuel_tax_maui,Island of Maui
fuels,alloc_amount,,county_fuel_tax_molokai,Island of Molokai
fuels,alloc_amount,,energy_security_fund,Energy Security Special Fund
fuels,alloc_amount,,energy_systems_fund,Energy Systems Development Special Fund
fuels,alloc_amount,,environmental_fund,Environmental Response Revolving Fund
fuels,alloc_amount,,ev_charging_fund,Electric Vehicle Charging System Subaccount
fuels,alloc_amount,,general_fund,General Fund
fuels,alloc_amount,,highway_fund,State Highway Special Fund
fuels,alloc_amount,,hydrogen_fund,Hydrogen Fueling System Subaccount
fuels,alloc_amount,,subtotal1,SUB-TOTAL
fuels,alloc_total,,boating_fund,State Boating Special Fund
fuels,alloc_total,,county_fuel_tax,County Fuel Tax
fuels,alloc_total,,county_fuel_tax_maui,Island of Maui
fuels,alloc_total,,environmental_fund,Environmental Tax Fund
fuels,alloc_total,,general_fund,General Fund
fuels,alloc_total,,subtotal1,SUB-TOTAL
fuels,alloc_total,,total,TOTAL
fuels,base_county,,aviation,Aviation fuel
fuels,base_county,,diesel_highway,Diesel Oil (highway)
fuels,base_county,,diesel_off_highway,DO (non-hwy)
fuels,base_county,,gasoline,Gasoline
fuels,base_county,,lpg_highway,Liquefied Petroleum Gas (highway)
fuels,base_county,,lpg_off_highway,LPG (off hwy)
fuels,base_county,,other_fuel,Other fuel
fuels,base_county,,small_boat_diesel,SB (diesel oil)
fuels,base_county,,small_boat_gasoline,Small Boats (gas)
fuels,base_county,,subtotal1,SUB-TOTAL
fuels,base_county,,total,TOTAL
fuels,base_gallons,,aviation,Aviation fuel
fuels,base_gallons,,diesel_highway,Diesel Oil (highway)
fuels,base_gallons,,diesel_off_highway,Diesel Oil (off-highway)
fuels,base_gallons,,ert_fossil,ERT - Fossil Fuels (MMBtu)
fuels,base_gallons,,ert_petroleum,ERT - Petroleum Products (barrel)
fuels,base_gallons,,gasoline,Gasoline
fuels,base_gallons,,lpg_highway,Liquefied Petroleum Gas (highway)
fuels,base_gallons,,lpg_off_highway,LPG (off hwy)
fuels,base_gallons,,other_fuel,Other fuel
fuels,base_gallons,,small_boat_diesel,Small Boats (diesel oil)
fuels,base_gallons,,small_boat_gasoline,Small Boats (gas)
fuels,base_gallons,,subtotal1,SUB-TOTAL
fuels,base_state,,aviation,Aviation fuel
fuels,base_state,,diesel_highway,Diesel Oil (highway)
fuels,base_state,,diesel_off_highway,Diesel Oil (off-highway)
fuels,base_state,,ert_fossil,ERT - Fossil Fuels (MMBtu)
fuels,base_state,,ert_petroleum,ERT - Petroleum Products (barrel)
fuels,base_state,,gasoline,Gasoline
fuels,base_state,,lpg_highway,Liquefied Petroleum Gas (highway)
fuels,base_state,,lpg_off_highway,LPG (off hwy)
fuels,base_state,,other_fuel,Other fuel
fuels,base_state,,small_boat_diesel,Small Boats (diesel oil)
fuels,base_state,,small_boat_gasoline,Small Boats (gas)
fuels,base_state,,subtotal1,SUB-TOTAL
fuels,base_state,,subtotal2,SUB-TOTAL
fuels,base_state,,total,TOTAL
fuels,base_total,,aviation,Aviation fuel
fuels,base_total,,diesel_highway,Diesel Oil (highway)
fuels,base_total,,diesel_off_highway,Diesel Oil (off-highway)
fuels,base_total,,ert_fossil,ERT - Fossil Fuels (MMBtu)
fuels,base_total,,ert_petroleum,ERT - Petroleum Products (barrel)
fuels,base_total,,gasoline,Gasoline
fuels,base_total,,lpg_highway,Liquefied Petroleum Gas (highway)
fuels,base_total,,lpg_off_highway,LPG (off hwy)
fuels,base_total,,other_fuel,Other fuel
fuels,base_total,,small_boat_diesel,Small Boats (diesel oil)
fuels,base_total,,small_boat_gasoline,Small Boats (gas)
fuels,base_total,,subtotal1,SUB-TOTAL
fuels,base_total,,subtotal2,SUB-TOTAL
fuels,base_total,,total,TOTAL
ge,base,,all_others_4,All Others (4%)
ge,base,,commissions,Commissions
ge,base,,contracting,Contracting
ge,base,,grand_total,GRAND TOTAL
ge,base,,hotel_rentals,Hotel Rentals
ge,base,,insurance_solicitors,Insurance Solicitors
ge,base,,interest,Interest
ge,base,,interest_all_others,Interest & All Others
ge,base,,manufacturing,Manufacturing
ge,base,,other_rentals,All Other Rentals
ge,base,,pineapple_canning,Pineapple Canning
ge,base,,producing,Producing
ge,base,,retailing,Retailing
ge,base,,services,Services
ge,base,,services_intermediary,Services (Intermediary)
ge,base,,services_wholesale,Services (Wholesale)
ge,base,,subtotal1,SUB-TOTAL
ge,base,,subtotal2,SUB-TOTAL
ge,base,,sugar_processing,Sugar Processing
ge,base,,theater,"Theater, Amuse., Radio, etc."
ge,base,,use_4,Use (4%)
ge,base,,use_half,Use (1/2%)
ge,base,,wholesaling,Wholesaling
ge,collections,,all_others_4,All Others (4%)
ge,collections,,allocated,ALLOCATED COLLECTIONS
ge,collections,,commissions,Commissions
ge,collections,,contracting,Contracting
ge,collections,,grand_total,GRAND TOTAL
ge,collections,,hotel_rentals,Hotel Rentals
ge,collections,,insurance_solicitors,Insurance Solicitors
ge,collections,,interest,Interest
ge,collections,,interest_all_others,Interest & All Others
ge,collections,,manufacturing,Manufacturing
ge,collections,,other_rentals,All Other Rentals
ge,collections,,pineapple_canning,Pineapple Canning
ge,collections,,producing,Producing
ge,collections,,retailing,Retailing
ge,collections,,services,Services
ge,collections,,services_intermediary,Services (Intermediary)
ge,collections,,services_wholesale,Services (Wholesale)
ge,collections,,subtotal1,SUB-TOTAL
ge,collections,,subtotal2,SUB-TOTAL
ge,collections,,sugar_processing,Sugar Processing
ge,collections,,theater,"Theater, Amuse., Radio, etc."
ge,collections,,unallocated,UNALLOCATED NET COLLECTIONS
ge,collections,,use_4,Use (4%)
ge,collections,,use_half,Use (1/2%)
ge,collections,,wholesaling,Wholesaling
liab_ge,base,,commissions,Commissions
liab_ge,base,,contracting,Contracting
liab_ge,base,,grand_total,GRAND TOTAL
liab_ge,base,,hotel_rentals,Hotel Rentals
liab_ge,base,,insurance_solicitors,Insurance Solicitors
liab_ge,base,,interest_all_others,Interest & All Others
liab_ge,base,,manufacturing,Manufacturing
liab_ge,base,,other_rentals,All Other Rentals
liab_ge,base,,producing,Producing
liab_ge,base,,retailing,Retailing
liab_ge,base,,services,Services
liab_ge,base,,services_intermediary,Services (Intermediary)
liab_ge,base,,services_wholesale,Services (Wholesale)
liab_ge,base,,subtotal1,SUB-TOTAL
liab_ge,base,,subtotal2,SUB-TOTAL
liab_ge,base,,theater,"Theater, Amuse., Radio, etc."
liab_ge,base,,use_4,Use (4%)
liab_ge,base,,use_half,Use (1/2%)
liab_ge,base,,wholesaling,Wholesaling
liab_ge,liability,,commissions,Commissions
liab_ge,liability,,contracting,Contracting
liab_ge,liability,,grand_total,GRAND TOTAL
liab_ge,liability,,hotel_rentals,Hotel Rentals
liab_ge,liability,,insurance_solicitors,Insurance Solicitors
liab_ge,liability,,interest_all_others,Interest & All Others
liab_ge,liability,,manufacturing,Manufacturing
liab_ge,liability,,other_rentals,All Other Rentals
liab_ge,liability,,producing,Producing
liab_ge,liability,,retailing,Retailing
liab_ge,liability,,services,Services
liab_ge,liability,,services_intermediary,Services (Intermediary)
liab_ge,liability,,services_wholesale,Services (Wholesale)
liab_ge,liability,,subtotal1,SUB-TOTAL
liab_ge,liability,,subtotal2,SUB-TOTAL
liab_ge,liability,,theater,"Theater, Amuse., Radio, etc."
liab_ge,liability,,unallocated,UNALLOCATED NET COLLECTIONS
liab_ge,liability,,use_4,Use (4%)
liab_ge,liability,,use_half,Use (1/2%)
liab_ge,liability,,wholesaling,Wholesaling
liab_tat,base,,timeshare,Timeshare Occupancy
liab_tat,base,,total,TOTAL
liab_tat,base,,transient_accommodations,Transient Accommodations
liab_tat,liability,,timeshare,Timeshare Occupancy
liab_tat,liability,,total,TOTAL
liab_tat,liability,,transient_accommodations,Transient Accommodations
liq,liquor,,penalties,Penalties and Interest
liq,liquor,,permits,Permit Fees
liq,liquor,,total,TOTAL COLLECTIONS
liq,liquor,,wholesale,Wholesale
liqtob,liquor,,penalties,Penalties and Interest
liqtob,liquor,,permits,Permit Fees
liqtob,liquor,,total,TOTAL COLLECTIONS
liqtob,liquor,,wholesale,Wholesale
liqtob,tobacco,,cigarettes,Cigarettes
liqtob,tobacco,,cigars,Cigars
liqtob,tobacco,,fund_cancer_research,Hawaii Cancer Research Fund
liqtob,tobacco,,fund_cigarette_stamp_admin,Cigarette Stamp Administrative Fund
liqtob,tobacco,,fund_cigarette_stamp_enforcement,Cigarette Stamp Enforcement Fund
liqtob,tobacco,,fund_community_health,Community Health Centers Fund
liqtob,tobacco,,fund_emergency_medical,Emergency Medical Service Fund
liqtob,tobacco,,fund_trauma,Trauma System Fund
liqtob,tobacco,,licenses,License Fees
liqtob,tobacco,,little_cigars,Little Cigars
liqtob,tobacco,,other_tobacco,All Other Tobacco Products
liqtob,tobacco,,penalties,Penalties and Interest
liqtob,tobacco,,retail_permits,Retail Permits
liqtob,tobacco,,total,TOTAL COLLECTIONS
tob,tobacco,,cigarettes,Cigarettes
tob,tobacco,,cigars,Cigars
tob,tobacco,,e_liquids,E-liquids
tob,tobacco,,fund_cancer_research,Hawaii Cancer Research Fund
tob,tobacco,,fund_cigarette_stamp_admin,Cigarette Stamp Administrative Fund
tob,tobacco,,fund_cigarette_stamp_enforcement,Cigarette Stamp Enforcement Fund
tob,tobacco,,fund_community_health,Community Health Centers Fund
tob,tobacco,,fund_emergency_medical,Emergency Medical Service Fund
tob,tobacco,,fund_tobacco_enforcement,Tobacco Enforcement Fund
tob,tobacco,,fund_trauma,Trauma System Fund
tob,tobacco,,licenses,License Fees
tob,tobacco,,little_cigars,Little Cigars
tob,tobacco,,other_tobacco,All Other Tobacco Products
tob,tobacco,,retail_permits,Retail Permits
tob,tobacco,,total,TOTAL NET COLLECTIONS
tob,tobacco,,unallocated,Unallocated Net Collections
`;
