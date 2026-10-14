/**
 * Copy of rprocess dotax dotax_labels.csv (label rules: row label regex → canonical item (first match wins, case-insensitive). A new DOTAX spelling is fixed here.)
 * Keep in sync with the R original; String.raw keeps the regex backslashes.
 */
export const LABELS_CSV = String.raw`type,section,sub,pattern,item
collec,collections,corp,"^Decl(\.|aration)? ?(of )?Est(\.|imated)? Taxes$",corp_decl_est
collec,collections,corp,"^Payment W/ ?Returns$",corp_pay_returns
collec,collections,corp,"^Refunds$",corp_refunds
collec,collections,ind,"^Decl(\.|aration)? ?(of )?Est(\.|imated)? Taxes$",ind_decl_est
collec,collections,ind,"^Payment W/ ?Returns$",ind_pay_returns
collec,collections,ind,"^WH Tax on Wages$",ind_withholding
collec,collections,ind,"^Refunds$",ind_refunds
collec,collections,*,"^Income-Corp",ignore
collec,collections,*,"^Income-Ind",ignore
collec,collections,*,"^Banks/Financial Corp\.?$",banks
collec,collections,*,"^Conveyance$",conveyance
collec,collections,*,"^Employment Sec(\.|urity) Contri(\.|butions?)$",employment_security
collec,collections,*,"^Fuel$",fuel
collec,collections,*,"^Fuel (&|and) Environmental$",fuel_environmental
collec,collections,*,"^Environmental$",environmental
collec,collections,*,"^(GE|General Excise) License(s|/Fees| and Fees)?$",ge_license
collec,collections,*,"^General Excise (&|and) Use$",general_excise
collec,collections,*,"^(Honolulu )?County Surcharges?$",county_surcharge
collec,collections,*,"^Inheritance/Estate$",inheritance
collec,collections,*,"^Insurance Fees$",insurance_fees
collec,collections,*,"^Insurance Premiums$",insurance_premiums
collec,collections,*,"^Liquor (Tax )?(and|&) Permits$",liquor
collec,collections,*,"^Mtr\. Vehicle Tax ?(/|and|&) ?Fees(, etc\.?)?$",motor_vehicle
collec,collections,*,"^Rental Vehicle Tax( (and|&) Fees)?$",rental_vehicle
collec,collections,*,"^Public Service Co(\.|mpanies)?$",public_service
collec,collections,*,"^Tobacco(,| and| Tax and| &) Licenses( (&|and) Permits|/Permits)?$",tobacco
collec,collections,*,"^Trans(\.|ient) Accomm(\.|odations?) ?(/ ?Time Share Occup\. )?Fees(/Tax)?$",tat_fees
collec,collections,*,"^Trans(\.|ient) Accomm(\.|odations?) ?Tax(/ ?Time Share Occup\. Tax)?$",tat
collec,collections,*,"^All Others$",all_others
collec,coll_change,*,"^Increase or Decrease$",ignore
collec,coll_change,*,"^Percent Change$",ignore
collec,distribution,*,"^DISTRIBUTION OF COLLECTIONS$",ignore
collec,distribution,*,"^SUB-?TOTAL$",subtotal
collec,distribution,*,"^State Airports? (Special )?Fund$",airport_fund
collec,distribution,*,"^(State )?Boating Special Fund$",boating_fund
collec,distribution,*,"^Cigarette Stamp Admin(istrative|\.) Fund$",cigarette_stamp_admin_fund
collec,distribution,*,"^Cigarette Stamp Enforcement Fund$",cigarette_stamp_enforcement_fund
collec,distribution,*,"^Convention Center (Enterprise )?(Special )?Fund$",convention_center_fund
collec,distribution,*,"^Employment Security Fund$",employment_security_fund
collec,distribution,*,"^Environmental (Response )?(Revolving |Tax )?Fund$",environmental_fund
collec,distribution,*,"^State General Fund$",general_fund
collec,distribution,*,"^State Highway (Special )?Fund$",highway_fund
collec,distribution,*,"^Natural Area Reserve Fund$",natural_area_reserve_fund
collec,distribution,*,"^Rental Housing (Revolving )?Fund$",rental_housing_fund
collec,distribution,*,"^Tourism Special Fund$",tourism_special_fund
collec,distribution,*,"^TAT Trust Fund$",tat_trust_fund
collec,distribution,*,"^Domestic Vi(o|lo)lence/Child Abuse (and )?Neglect Funds?$",domestic_violence_fund
collec,distribution,*,"^School (Minor )?Repairs? (&|and) Maintenance Fund$",school_repairs_fund
collec,distribution,*,"^(.+)$",*
collec,county_surcharge,*,"^HONOLULU COUNTY SURCHARGE$",honolulu_surcharge
collec,county_surcharge,*,"^COUNTY SURCHARGES?$",county_surcharges
collec,county_surcharge,*,"^City (and|&) County of Honolulu$",surcharge_hon
collec,county_surcharge,*,"^County of Maui$",surcharge_mau
collec,county_surcharge,*,"^County of Hawaii$",surcharge_haw
collec,county_surcharge,*,"^County of Kauai$",surcharge_kau
collec,county_revenue,*,"^\(?(OTHER\)? )?COUNTY REVENUE:?$",ignore
collec,county_revenue,*,"^Fuel Tax$",county_fuel_tax
collec,county_revenue,*,"^(Trans\. Accomm\. Tax|Transient Accommodations? Tax)$",county_tat
collec,county_revenue,*,"^\(?(OTHER\)? )?COUNTY REVENUE TOTAL$",county_revenue_total
collec,grand_total,*,"^TOTAL$",grand_total
ge,*,*,"^Retailing$",retailing
ge,*,*,"^Services$",services
ge,*,*,"^Contracting$",contracting
ge,*,*,"^Theater, Amuse\., Radio, etc\.$",theater
ge,*,*,"^Interest (&|and) All Others$",interest_all_others
ge,*,*,"^Interest$",interest
ge,*,*,"^All Others \(4%\)$",all_others_4
ge,*,*,"^Commissions$",commissions
ge,*,*,"^Hotel Rentals$",hotel_rentals
ge,*,*,"^All Other Rentals$",other_rentals
ge,*,*,"^Use \(4%\)$",use_4
ge,*,*,"^Insurance Solicitors$",insurance_solicitors
ge,*,*,"^Sugar Processing$",sugar_processing
ge,*,*,"^Pineapple Canning$",pineapple_canning
ge,*,*,"^Producing$",producing
ge,*,*,"^Manufacturing$",manufacturing
ge,*,*,"^Wholesaling$",wholesaling
ge,*,*,"^Services \(Intermediary\)$",services_intermediary
ge,*,*,"^Services \(Wholesale\)$",services_wholesale
ge,*,*,"^Use \(1/2%\)$",use_half
ge,*,*,"^SUB-?TOTAL$",subtotal
ge,*,*,"^ALLOCATED COLLECTIONS$",allocated
ge,*,*,"^UNALLOCATED NET COLLECTIONS$",unallocated
ge,*,*,"^GRAND TOTAL$",grand_total
ge,*,*,"^which may be applicable\.?$",ignore
liab_tat,*,*,"^Transient Accommodations?$",transient_accommodations
liab_tat,*,*,"^Timeshare Occupancy$",timeshare
liab_tat,*,*,"^TOTAL$",total
liab_tat,*,*,"^Date for creating the cube",ignore
fuels,base,*,"^Gasoline",gasoline
fuels,base,*,"^(Diesel|D\.?O\.?)\b.*(Off|Non)",diesel_off_highway
fuels,base,*,"^(Diesel|D\.?O\.?)\b.*(Hwy|Highway)",diesel_highway
fuels,base,*,"^(Liquefied|LPG|Liq).*(Off|Non)",lpg_off_highway
fuels,base,*,"^(Liquefied|LPG|Liq)",lpg_highway
fuels,base,*,"^(Small Boat|SB).*Gas",small_boat_gasoline
fuels,base,*,"^(Small Boat|SB).*Die",small_boat_diesel
fuels,base,*,"^Avia(r)?tion",aviation
fuels,base,*,"^Other Fuel",other_fuel
fuels,base,*,"^SUB-?\s*TOTAL",subtotal
fuels,base,*,"^(ERT.*Petrol|Environmental)",ert_petroleum
fuels,base,*,"^ERT.*Fossil",ert_fossil
fuels,base,*,"^TOTAL",total
fuels,alloc,*,"Highway",highway_fund
fuels,alloc,*,"Airport",airport_fund
fuels,alloc,*,"Boating",boating_fund
fuels,alloc,*,"^County Fuel Tax",county_fuel_tax
fuels,alloc,*,"^(Island of )?Lanai",county_fuel_tax_lanai
fuels,alloc,*,"^(Island of )?Molokai",county_fuel_tax_molokai
fuels,alloc,*,"^(Island of )?Maui$",county_fuel_tax_maui
fuels,alloc,*,"^SUB-?\s*TOTAL",subtotal
fuels,alloc,*,"Environmental",environmental_fund
fuels,alloc,*,"Energy Security",energy_security_fund
fuels,alloc,*,"Energy Systems",energy_systems_fund
fuels,alloc,*,"Agricultur",agricultural_fund
fuels,alloc,*,"Electric Vehicle",ev_charging_fund
fuels,alloc,*,"Hydrogen",hydrogen_fund
fuels,alloc,*,"General Fund",general_fund
fuels,alloc,*,"^TOTAL",total
liqtob,liquor,*,"^TOTAL",total
liqtob,liquor,*,"Wholesale",wholesale
liqtob,liquor,*,"Penalt",penalties
liqtob,liquor,*,"Permit",permits
liqtob,tobacco,*,"^NET TAX COLLECTIONS$",ignore
liqtob,tobacco,*,"^TOTAL",total
liqtob,tobacco,*,"^Cigarettes",cigarettes
liqtob,tobacco,*,"Other Tobacco|^Tobacco Products",other_tobacco
liqtob,tobacco,*,"^Little Cigars",little_cigars
liqtob,tobacco,*,"^Cigars",cigars
liqtob,tobacco,*,"E-?Liquid",e_liquids
liqtob,tobacco,*,"Penalt",penalties
liqtob,tobacco,*,"Retail Permit",retail_permits
liqtob,tobacco,*,"License",licenses
liqtob,tobacco,*,"Unallocated",unallocated
liqtob,tobacco,*,"Stamp Admin",fund_cigarette_stamp_admin
liqtob,tobacco,*,"Stamp Enf",fund_cigarette_stamp_enforcement
liqtob,tobacco,*,"Cancer",fund_cancer_research
liqtob,tobacco,*,"Trauma",fund_trauma
liqtob,tobacco,*,"Emergency",fund_emergency_medical
liqtob,tobacco,*,"Community Health",fund_community_health
liqtob,tobacco,*,"Tobacco Enf",fund_tobacco_enforcement
`;
