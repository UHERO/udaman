import { readFileSync } from "fs";
import path from "path";

import { describe, expect, it } from "bun:test";

import { parsePropertyHTML } from "./parse";

const FIXTURES = path.join(__dirname, "__fixtures__");

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf-8");
}

type R = Record<string, unknown>;

// ─── Pre-parse all fixtures once ────────────────────────────────────

const oahuRes = parsePropertyHTML(
  loadFixture("oahu-residential.html"),
  "1-3-3-041-087-0000",
);
const oahuCondo = parsePropertyHTML(
  loadFixture("oahu-condo.html"),
  "1-1-1-065-037-0181",
);
const oahuCondoProject = parsePropertyHTML(
  loadFixture("oahu-condo-project.html"),
  "1-2-7-013-008-0000",
);
const oahuCondoUnit = parsePropertyHTML(
  loadFixture("oahu-condo-unit.html"),
  "1-2-7-013-008-0144",
);
const oahuApt = parsePropertyHTML(
  loadFixture("oahu-apartment-building.html"),
  "1-2-7-019-003-0000",
);
const mauiRes = parsePropertyHTML(
  loadFixture("maui-residential.html"),
  "2-3-8-038-016-0000",
);
const mauiCondoProject = parsePropertyHTML(
  loadFixture("maui-condo-project.html"),
  "2-3-8-046-010-0000",
);
const mauiCondoUnit = parsePropertyHTML(
  loadFixture("maui-condo-unit.html"),
  "2-3-8-046-010-0050",
);
const mauiApt = parsePropertyHTML(
  loadFixture("maui-apartment-building.html"),
  "2-3-8-007-050-0000",
);
const captcha = parsePropertyHTML(
  loadFixture("captcha.html"),
  "1-0-0-000-000-0000",
);

// ─── Page Status Detection ──────────────────────────────────────────

describe("detectPageStatus", () => {
  it("detects successful property pages", () => {
    expect(oahuRes.status).toBe("success");
    expect(oahuCondo.status).toBe("success");
    expect(oahuCondoUnit.status).toBe("success");
    expect(oahuApt.status).toBe("success");
    expect(mauiRes.status).toBe("success");
    expect(mauiCondoUnit.status).toBe("success");
    expect(mauiApt.status).toBe("success");
  });

  it("detects condo project pages", () => {
    expect(oahuCondoProject.status).toBe("condo_project");
  });

  it("truncates condo master property_class to first sentence", () => {
    const parcel = oahuCondoProject.parcel_information as Record<
      string,
      unknown
    >;
    expect(parcel.property_class).toBe("This is a Condo Master.");
  });

  it("maui condo project parses as success (no unit table)", () => {
    // Maui condo projects have a different structure than Oahu
    expect(mauiCondoProject.status).toBe("success");
  });

  it("detects Cloudflare challenge as non-success", () => {
    expect(captcha.status).not.toBe("success");
    expect(captcha.parcel_information).toBeUndefined();
  });
});

// ─── Parcel Information ─────────────────────────────────────────────

describe("parcel_information", () => {
  describe("Oahu", () => {
    const p = oahuRes.parcel_information as R;

    it("extracts parcel number", () => {
      expect(p.parcel_number).toBe("330410870000");
    });

    it("extracts location address", () => {
      expect(p.location_address).toBe("1730 MAOI PL");
    });

    it("extracts property class", () => {
      expect(p.property_class).toBe("RESIDENTIAL A");
    });

    it("parses land area sqft as number", () => {
      expect(p.land_area_approximate_sq_ft).toBe(6563);
    });

    it("computes acres from sqft", () => {
      expect(p.land_area_acres).toBeCloseTo(0.1507, 3);
    });

    it("extracts legal information", () => {
      expect(p.legal_information).toContain("LOT 233");
    });
  });

  describe("Oahu condo", () => {
    const p = oahuCondo.parcel_information as R;

    it("extracts condo parcel number", () => {
      expect(p.parcel_number).toBe("110650370181");
    });

    it("extracts condo address with unit", () => {
      expect(p.location_address).toBe("5333 LIKINI ST 1808");
    });

    it("extracts project name", () => {
      expect(p.project_name).toBe("PLAZA LANDMARK");
    });

    it("extracts legal information with APT details", () => {
      expect(p.legal_information).toContain("APT 1808");
    });
  });

  describe("Oahu apartment building", () => {
    const p = oahuApt.parcel_information as R;

    it("extracts parcel info", () => {
      expect(p.parcel_number).toBe("270190030000");
      expect(p.location_address).toBe("2453 KAPIOLANI BLVD");
      expect(p.land_area_approximate_sq_ft).toBe(6000);
    });
  });

  describe("Maui", () => {
    const p = mauiRes.parcel_information as R;

    it("extracts Maui parcel number", () => {
      expect(p.parcel_number).toBe("380380160000");
    });

    it("extracts Maui address (includes city/zip)", () => {
      expect(p.location_address).toContain("233 HOLUA DR");
      expect(p.location_address).toContain("KAHULUI");
    });

    it("extracts Maui-specific fields: neighborhood_code and zoning", () => {
      expect(p.neighborhood_code).toBe("3823-1");
      expect(p.zoning).toContain("R2");
    });

    it("parses Maui land area", () => {
      expect(p.land_area_approximate_sq_ft).toBe(10816);
      expect(p.land_area_acres).toBeCloseTo(0.2483, 3);
    });
  });

  it("merges untitled_section into parcel_information", () => {
    // Maui uses untitled_section for damage/reentry zone
    expect(mauiRes.untitled_section).toBeUndefined();
    expect(oahuRes.untitled_section).toBeUndefined();
  });
});

// ─── Owner Information ──────────────────────────────────────────────

describe("owner_information", () => {
  it("extracts multiple Oahu owners with types", () => {
    const owners = (oahuRes.owner_information as R).all_owners as R[];
    expect(owners.length).toBe(2);
    expect(owners[0].owner_name).toBeDefined();
    expect(owners[0].owner_type).toBe("Fee Owner");
  });

  it("extracts single Oahu condo owner", () => {
    const owners = (oahuCondo.owner_information as R).all_owners as R[];
    expect(owners).toHaveLength(1);
    expect(owners[0].owner_name).toBe("DISMUKE,ANDREA L TR");
  });

  it("extracts Maui owners", () => {
    const owners = (mauiRes.owner_information as R).all_owners as R[];
    expect(owners.length).toBeGreaterThanOrEqual(1);
    expect(owners[0].owner_name).toBeDefined();
  });

  it("extracts Maui condo unit owner", () => {
    const owners = (mauiCondoUnit.owner_information as R).all_owners as R[];
    expect(owners.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Assessment Information ─────────────────────────────────────────

describe("assessment_information", () => {
  describe("Oahu residential", () => {
    const info = oahuRes.assessment_information as R;
    const current = info.current_assessments as R[];

    it("has current and historical assessments", () => {
      expect(current.length).toBeGreaterThanOrEqual(1);
      expect((info.historical_assessments as R[]).length).toBe(10);
    });

    it("has correct fields", () => {
      const a = current[0];
      expect(a.tax_year).toBe("2025");
      expect(a.property_class).toBe("RESIDENTIAL A");
    });

    it("normalizes dollar values to numbers", () => {
      const a = current[0];
      expect(typeof a.assessed_land_value).toBe("number");
      expect(a.assessed_land_value).toBe(948800);
      expect(a.assessed_building_value).toBe(238000);
      expect(a.total_property_assessed_value).toBe(1186800);
    });

    it("handles zero exemptions", () => {
      const a = current[0];
      expect(a.dedicated_use_value).toBe(0);
      expect(a.land_exemption).toBe(0);
    });
  });

  describe("Maui residential", () => {
    const info = mauiRes.assessment_information as R;
    const current = info.current_assessments as R[];

    it("extracts Maui assessments", () => {
      expect(current.length).toBeGreaterThanOrEqual(1);
    });

    it("extracts Maui-specific fields: market_land_value, agricultural_land_value", () => {
      const a = current[0];
      expect(a.market_land_value).toBe(738200);
      expect(a.agricultural_land_value).toBe(0);
    });

    it("extracts Maui property class from assessment", () => {
      const a = current[0];
      expect(a.property_class).toBe("OWNER-OCCUPIED/HOMEOWNER");
    });

    it("extracts exemption amounts", () => {
      const a = current[0];
      expect(a.total_property_exemption).toBe(300000);
      expect(a.total_net_taxable_value).toBe(1059000);
    });
  });

  describe("Oahu apartment building", () => {
    const info = oahuApt.assessment_information as R;

    it("has assessments for commercial property", () => {
      expect((info.current_assessments as R[]).length).toBeGreaterThanOrEqual(
        1,
      );
      expect((info.historical_assessments as R[]).length).toBe(10);
    });
  });
});

// ─── Land Information ───────────────────────────────────────────────

describe("land_information", () => {
  it("extracts Oahu land classifications", () => {
    const info = oahuRes.land_information as R;
    const cls = info.land_classifications as R[];
    expect(cls.length).toBeGreaterThanOrEqual(1);
    expect(cls[0].land_classification).toBe("RESIDENTIAL");
    expect(cls[0].square_footage).toBe("6,563");
    expect(cls[0].acreage).toBe("0.1507");
  });

  it("extracts apartment building land classifications", () => {
    const info = oahuApt.land_information as R;
    const cls = info.land_classifications as R[];
    expect(cls.length).toBeGreaterThanOrEqual(1);
  });

  it("condos typically lack land_information", () => {
    expect(oahuCondo.land_information).toBeUndefined();
  });
});

// ─── Residential Improvement Information ────────────────────────────

describe("residential/improvement information", () => {
  describe("Oahu residential", () => {
    const ri = oahuRes.residential_improvement_information as R;

    it("extracts building details", () => {
      expect(ri.building_number).toBe("1");
      expect(ri.occupancy).toBe("SINGLE-FAMILY");
      expect(ri.framing).toBe("WOOD/SINGLE WALL");
      expect(ri.year_built).toBe("1950");
    });
  });

  describe("Oahu condo", () => {
    const ri = oahuCondo.residential_improvement_information as R;

    it("extracts condo improvement info", () => {
      expect(ri.building_number).toBe("1");
      expect(ri.year_built).toBe("1984");
      expect(ri.occupancy).toBe("H.P.R.");
      expect(ri.framing).toBe("CONCRETE");
    });
  });

  describe("Maui residential (uses improvement_information)", () => {
    const ri = mauiRes.improvement_information as R;

    it("extracts Maui improvement info", () => {
      expect(ri).toBeDefined();
      expect(ri.building_number).toBe("1");
      expect(ri.year_built).toBe("1998");
      expect(ri.framing).toBe("Frame");
    });

    it("extracts Maui-specific fields", () => {
      expect(ri.eff_year_built).toBe("2000");
      expect(ri.living_area).toBe("2,158");
      expect(ri.percent_complete).toBe("100%");
    });
  });

  describe("Maui condo unit (uses improvement_information)", () => {
    const ri = mauiCondoUnit.improvement_information as R;

    it("extracts Maui condo improvement", () => {
      expect(ri).toBeDefined();
      expect(ri.year_built).toBe("1994");
      expect(ri.framing).toBe("Condominium");
    });
  });
});

// ─── Commercial Improvement Information ─────────────────────────────

describe("commercial_improvement_information", () => {
  const ci = oahuApt.commercial_improvement_information as R;

  it("extracts commercial improvement data for apartment building", () => {
    expect(ci).toBeDefined();
  });

  it("has building details", () => {
    expect(ci.building_number).toBe("0001");
    expect(ci.structure_type).toBe("APARTMENTS - M-3");
    expect(ci.year_built).toBe("1953");
    expect(ci.units).toBe("6");
  });

  it("has floor detail rows in table_data", () => {
    const details = ci.table_data as R[];
    expect(details).toBeDefined();
    expect(details.length).toBeGreaterThanOrEqual(2);
    expect(details[0].floor).toBe("01");
    expect(details[0].area).toBe("1,540");
    expect(details[0].usage).toBe("Multiple Res (Low Rise)");
  });
});

// ─── Sales Information ──────────────────────────────────────────────

describe("sales_information", () => {
  describe("Oahu residential", () => {
    const sales = (oahuRes.sales_information as R).sales as R[];

    it("extracts sales", () => {
      expect(sales.length).toBe(4);
    });

    it("has correct fields", () => {
      const s = sales[0];
      expect(s.sale_date).toBeDefined();
      expect(s.instrument_type).toBeDefined();
      expect(s.date_of_recording).toBeDefined();
    });
  });

  describe("Oahu condo (12 sales)", () => {
    it("extracts all sales", () => {
      const sales = (oahuCondo.sales_information as R).sales as R[];
      expect(sales.length).toBe(12);
    });
  });

  describe("Maui residential", () => {
    const sales = (mauiRes.sales_information as R).sales as R[];

    it("extracts Maui sales", () => {
      expect(sales.length).toBe(6);
    });

    it("has Maui sale fields", () => {
      const s = sales[0];
      expect(s.sale_date).toBeDefined();
      expect(s.instrument).toBeDefined();
      expect(s.instrument_type).toBeDefined();
      expect(s.valid_sale).toBeDefined();
    });
  });

  describe("Maui condo project", () => {
    it("extracts condo project sales", () => {
      const sales = (mauiCondoProject.sales_information as R).sales as R[];
      expect(sales.length).toBe(12);
    });
  });
});

// ─── Historical Tax Information ─────────────────────────────────────

describe("historical_tax_information", () => {
  describe("Oahu condo", () => {
    const taxInfo = oahuCondo.historical_tax_information as R;
    const summaries = taxInfo.tax_summary as R[];

    it("extracts 10 years of tax history", () => {
      expect(summaries.length).toBe(10);
    });

    it("has correct year", () => {
      expect(summaries[0].year).toBe("2025");
    });

    it("normalizes tax amounts", () => {
      expect(typeof summaries[0].tax).toBe("number");
      expect(summaries[0].tax).toBeCloseTo(1062.6, 1);
    });

    it("extracts nested tax details", () => {
      const details = summaries[0].tax_details as R[];
      expect(details).toBeDefined();
      expect(details.length).toBe(4);
    });

    it("extracts nested tax payments", () => {
      const payments = summaries[0].tax_payments as R[];
      expect(payments).toBeDefined();
      expect(payments.length).toBe(2);
    });

    it("extracts totals from nested tables", () => {
      const totals = summaries[0].tax_details_totals as R;
      expect(totals).toBeDefined();
      expect(totals.total_tax).toBeDefined();
    });
  });

  describe("Oahu residential", () => {
    const taxInfo = oahuRes.historical_tax_information as R;
    const summaries = taxInfo.tax_summary as R[];

    it("extracts tax history for residential", () => {
      expect(summaries.length).toBe(10);
    });

    it("has nested details", () => {
      expect(summaries[0].tax_details).toBeDefined();
    });
  });

  describe("Maui residential", () => {
    const taxInfo = mauiRes.historical_tax_information as R;
    const summaries = taxInfo.tax_summary as R[];

    it("extracts Maui tax history", () => {
      expect(summaries.length).toBe(10);
    });
  });

  describe("Maui condo unit", () => {
    const taxInfo = mauiCondoUnit.historical_tax_information as R;
    const summaries = taxInfo.tax_summary as R[];

    it("extracts Maui condo tax history", () => {
      expect(summaries.length).toBe(10);
    });
  });
});

// ─── Current Tax Bill Information ───────────────────────────────────

describe("current_tax_bill_information", () => {
  it("extracts Maui current tax bills", () => {
    const bills = mauiRes.current_tax_bill_information as R;
    expect(bills).toBeDefined();
    const rows = bills.table_data as R[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].tax_period).toBe("2025-2");
    expect(rows[0].description).toBe("Real Property Tax");
    expect(typeof rows[0].amount_due).toBe("number");
    expect(rows[0].amount_due).toBeCloseTo(873.67, 1);
  });

  it("extracts Oahu current tax bills", () => {
    const bills = oahuApt.current_tax_bill_information as R;
    expect(bills).toBeDefined();
    const rows = bills.table_data as R[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(typeof rows[0].amount_due).toBe("number");
  });

  it("extracts Oahu condo unit tax bills", () => {
    const bills = oahuCondoUnit.current_tax_bill_information as R;
    expect(bills).toBeDefined();
  });
});

// ─── Condominium/Apartment Unit Information ─────────────────────────

describe("condominium_apartment_unit_information", () => {
  it("extracts unit list for Oahu condo project", () => {
    const ci = oahuCondoProject.condominium_apartment_unit_information as R;
    expect(ci).toBeDefined();
    const units = ci.table_data as R[];
    expect(units.length).toBe(211);
  });

  it("has correct fields per unit", () => {
    const ci = oahuCondoProject.condominium_apartment_unit_information as R;
    const unit = (ci.table_data as R[])[0];
    expect(unit.parcel_number).toBeDefined();
    expect(unit.unit_number).toBeDefined();
    expect(unit.owner_name).toBeDefined();
    expect(unit.qpub_link).toBeDefined();
  });
});

// ─── Permit Information ─────────────────────────────────────────────

describe("permit_information", () => {
  it("extracts Oahu permits", () => {
    const permits = oahuRes.permit_information as R;
    expect(permits).toBeDefined();
    const rows = permits.table_data as R[];
    expect(rows.length).toBe(2);
    expect(rows[0].permit_number).toBe("643948");
    expect(rows[0].reason).toBe("ADDITION");
    expect(rows[0].permit_amount).toBe(14500);
  });

  it("extracts Maui permits", () => {
    const permits = mauiRes.permit_information as R;
    expect(permits).toBeDefined();
    const rows = permits.table_data as R[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts apartment building permits", () => {
    const permits = oahuApt.permit_information as R;
    expect(permits).toBeDefined();
  });
});

// ─── Residential Additions ──────────────────────────────────────────

describe("residential additions", () => {
  it("extracts Oahu residential additions", () => {
    const additions = oahuRes.residential_additions as R;
    expect(additions).toBeDefined();
    expect(additions.table_data).toBeDefined();
  });

  it("extracts Maui additions (section named 'additions')", () => {
    const additions = mauiRes.additions as R;
    expect(additions).toBeDefined();
    const rows = additions.table_data as R[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Maui additions have card/line/area structure
    expect(rows[0].card).toBeDefined();
    expect(rows[0].area).toBeDefined();
  });
});

// ─── Accessory Information (Maui) ───────────────────────────────────

describe("accessory_information", () => {
  it("extracts Maui accessory structures", () => {
    const acc = mauiRes.accessory_information as R;
    expect(acc).toBeDefined();
    // Maui accessory info is parsed generically — uses 'sales' key from table structure
    // The important thing is the data is captured
    const rows = (acc.sales ?? acc.table_data) as R[];
    expect(rows).toBeDefined();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].description).toBe("WOOD STORAGE EC");
    expect(rows[0].year_built).toBe("2005");
  });
});

// ─── Map / Sketch ───────────────────────────────────────────────────

describe("map section", () => {
  it("extracts map URL for Oahu residential", () => {
    const map = oahuRes.map as R;
    expect(map).toBeDefined();
    expect(typeof map.map_url).toBe("string");
    expect((map.map_url as string).length).toBeGreaterThan(0);
  });

  it("extracts map URL for Oahu condo project", () => {
    const map = oahuCondoProject.map as R;
    expect(map).toBeDefined();
    expect(map.map_url).toBeDefined();
  });
});

// ─── Cross-island completeness ──────────────────────────────────────

describe("cross-island section coverage", () => {
  it("all fixtures have parcel_information", () => {
    const all = [
      oahuRes,
      oahuCondo,
      oahuCondoUnit,
      oahuApt,
      mauiRes,
      mauiCondoUnit,
      mauiApt,
    ];
    for (const r of all) {
      expect(r.parcel_information).toBeDefined();
    }
  });

  it("all fixtures have owner_information", () => {
    const all = [
      oahuRes,
      oahuCondo,
      oahuCondoUnit,
      oahuApt,
      mauiRes,
      mauiCondoUnit,
      mauiApt,
      mauiCondoProject,
    ];
    for (const r of all) {
      expect(r.owner_information).toBeDefined();
      expect((r.owner_information as R).all_owners).toBeDefined();
    }
  });

  it("all non-project fixtures have assessment_information", () => {
    const all = [
      oahuRes,
      oahuCondo,
      oahuCondoUnit,
      oahuApt,
      mauiRes,
      mauiCondoUnit,
      mauiApt,
      mauiCondoProject,
    ];
    for (const r of all) {
      const info = r.assessment_information as R;
      expect(info).toBeDefined();
      expect((info.current_assessments as R[]).length).toBeGreaterThanOrEqual(
        1,
      );
    }
  });

  it("all non-project fixtures have sales_information", () => {
    const all = [
      oahuRes,
      oahuCondo,
      oahuCondoUnit,
      oahuApt,
      mauiRes,
      mauiCondoUnit,
      mauiApt,
      mauiCondoProject,
    ];
    for (const r of all) {
      expect(r.sales_information).toBeDefined();
    }
  });
});
