const hhf_universe = {
    access: [
        { amentities: ["poicount_grocery", "poicount_recreation", "poicount_restaurants_bars", "poicount_health"] },
        { jobs: ["jobs_30", "jobs_d30", "jobs_t30", "jobs_d30_perc", "jobs_t30_perc"] }], // jobs_30 = jobs_d30 + jobs_t30
    demographics: [
        { ageStructure: ["keiki_perc", "kupuna_perc","age>85", "age7584", "age6574", "age5564", "age4554", "age3544", "age2534", "age1824", "age0517", "age0004"] },
        { population: ["population"] },
        { racialDiversity: ["asian", "white", "black", "hawpi"] },
        { householdIncome: ["medhhinc"] },
        { unemployment: ["unemployment"] },
        { education: ["col", "hs"] },
    ],
    housingStock: [
        { housingCharacteristics: ["housingunits", "medunitage", "perc_owner_nonlocal"] },
        { newProjectPermitted: ["newsfr", "newmfr","newsfr_5y", "newmfr_5y"] },
        { permitProcessingTime: ["meddelaysfr", "meddelaymfr","meddelaymfr_5y", "meddelaysfr_5y"] },
        { vacationRentals: ["tvrunits", "tvrshare"] },
        { subsidizedHousing: ["subsunits", "subsunitsperc"] }
    ],
    propertyMarket: [
        { homeownership: ["owner", "mortgaged"] },
        { propertyPrices: ["medpricetg_SFR", "medpricetg_CND", "medpricetg_SFR_index", "medpricetg_CND_index", "rsi"] },
        { propertyTransactions: ["transactions_SFR", "instate_SFR", "instate_CND", "outofstate_SFR", "transactions_CND", "outofstate_CND"] },
        { homeAffordability: ["medownercosts", "medownercostasperinc", "neededinc_sfr", "neededinc_cnd"] }
    ],
    rentalMarket: [
        { rentalPopulation: ["renter"] },
        { rents: ["medrent_acs", "medrent_craig"] },
        { rentalAffordability: ["neededinc_rent_craig", "medrentasperinc", "rentburd30", "rentburd50", "neededinc_rent"] }
    ],
    zoning: [
        { zoning: ["zoning", "popperacre", "mfr_share"] }
    ]
}