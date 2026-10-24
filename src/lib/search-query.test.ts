import { describe, expect, test } from "bun:test";

import {
  buildAllTermsRegex,
  buildAnyTermRegex,
  countTermHits,
  normalizeQuery,
  parseSearchQuery,
  rankSeries,
} from "./search-query";

describe("normalizeQuery", () => {
  test("strips diacritics and okina", () => {
    expect(normalizeQuery("Lānaʻi")).toBe("lanai");
    expect(normalizeQuery("Kaua‘i Kaua'i")).toBe("kauai kauai");
  });

  test("keeps _ @ - % and spaces out other punctuation", () => {
    expect(normalizeQuery("YPJ_R@HI, semi-annual (10%)")).toBe(
      "ypj_r@hi semi-annual 10%",
    );
  });
});

describe("parseSearchQuery", () => {
  test("unemployment rate Honolulu", () => {
    const p = parseSearchQuery("unemployment rate Honolulu");
    expect(p.terms).toEqual(["unemployment", "rate"]);
    expect(p.geo).toBe("HON");
    expect(p.freq).toBeUndefined();
  });

  test("visitor arrivals Maui monthly", () => {
    const p = parseSearchQuery("visitor arrivals Maui monthly");
    expect(p.terms).toEqual(["visitor", "arrival"]);
    expect(p.geo).toBe("MAU");
    expect(p.freq).toBe("M");
  });

  test("Kauaʻi jobs", () => {
    const p = parseSearchQuery("Kauaʻi jobs");
    expect(p.terms).toEqual(["job"]);
    expect(p.geo).toBe("KAU");
  });

  test("GDP (real)", () => {
    const p = parseSearchQuery("GDP (real)");
    expect(p.terms).toEqual(["gdp", "real"]);
    expect(buildAllTermsRegex(p.terms)).not.toMatch(/\((?!\?=)/);
  });

  test("Hawaii County is HAW, bare Hawaii is HI", () => {
    expect(parseSearchQuery("Hawaii County population").geo).toBe("HAW");
    expect(parseSearchQuery("Hawaii County population").terms).toEqual([
      "population",
    ]);
    expect(parseSearchQuery("Hawaii personal income").geo).toBe("HI");
    expect(parseSearchQuery("Maui, Hawaii jobs").geo).toBe("MAU");
  });

  test("two geographies → no geo filter, both mentioned in order", () => {
    const p = parseSearchQuery("Maui vs Kauai unemployment");
    expect(p.geo).toBeUndefined();
    expect(p.geosMentioned).toEqual(["MAU", "KAU"]);
    expect(p.terms).toEqual(["unemployment"]);
  });

  test("no topic left", () => {
    const p = parseSearchQuery("Honolulu monthly");
    expect(p.terms).toEqual([]);
    expect(p.geo).toBe("HON");
    expect(p.freq).toBe("M");
  });

  test("semiannual is S, bare year / month are topic words", () => {
    expect(parseSearchQuery("semi-annual income").freq).toBe("S");
    expect(parseSearchQuery("semiannual income").freq).toBe("S");
    const p = parseSearchQuery("year-over-year month change");
    expect(p.freq).toBeUndefined();
    expect(p.terms).toEqual(["year-over-year", "month", "change"]);
  });

  test("seasonal adjustment words become a preference", () => {
    expect(parseSearchQuery("jobs seasonally adjusted").saPreference).toBe(
      "sa",
    );
    const nsa = parseSearchQuery("jobs not seasonally adjusted");
    expect(nsa.saPreference).toBe("nsa");
    expect(nsa.terms).toEqual(["job"]);
    expect(parseSearchQuery("jobs NSA").saPreference).toBe("nsa");
  });

  test("level words aren't topic terms", () => {
    const p = parseSearchQuery("job count Kauai");
    expect(p.terms).toEqual(["job"]);
    expect(p.geo).toBe("KAU");
    expect(parseSearchQuery("total number of visitors").terms).toEqual([
      "visitor",
    ]);
  });

  test("drops stopwords and keeps at most 5 terms", () => {
    const p = parseSearchQuery(
      "the visitors by air and sea for the hotel industry cruise statistics",
    );
    expect(p.terms).toEqual(["visitor", "air", "sea", "hotel", "industry"]);
  });
});

describe("regex builders", () => {
  test("all terms uses anchored lookaheads", () => {
    expect(buildAllTermsRegex(["unemployment", "rate"])).toBe(
      "^(?=.*\\bunemployment)(?=.*\\brate)",
    );
  });

  test("escapes regex metacharacters", () => {
    expect(buildAllTermsRegex(["c++"])).toBe("^(?=.*\\bc\\+\\+)");
  });

  test("no \\b before a non-word start", () => {
    expect(buildAnyTermRegex(["job", "%"])).toBe("(\\bjob|%)");
  });

  test("the built regex behaves as all-terms-any-order", () => {
    const re = new RegExp(buildAllTermsRegex(["rate", "unemployment"]), "i");
    expect(re.test("Unemployment Rate")).toBe(true);
    expect(re.test("Unemployment Count")).toBe(false);
  });
});

describe("ranking", () => {
  const s = (
    name: string,
    title: string,
    extra: Record<string, unknown> = {},
  ) => ({ name, title, ...extra });

  test("title hits outrank description hits", () => {
    const ranked = rankSeries(
      [
        s("X@HON.M", "Labor Force", { description: "unemployment rate" }),
        s("UR@HON.M", "Unemployment Rate"),
      ],
      ["unemployment", "rate"],
    );
    expect(ranked[0].name).toBe("UR@HON.M");
  });

  test("ties prefer Total aggregates", () => {
    const ranked = rankSeries(
      [
        s("ECT@KAU.A", "Construction Jobs"),
        s("E_NF@KAU.A", "Total Nonfarm Jobs"),
      ],
      ["job"],
    );
    expect(ranked[0].name).toBe("E_NF@KAU.A");
  });

  test("a description repeating the title adds nothing", () => {
    const nsa = s("E_NFNS@KAU.M", "Total Nonfarm Jobs", {
      description: "Total nonfarm jobs, not seasonally adjusted",
      seasonalAdjustment: "not_seasonally_adjusted",
    });
    const sa = s("E_NF@KAU.M", "Total Nonfarm Jobs", {
      seasonalAdjustment: "seasonally_adjusted",
    });
    expect(rankSeries([nsa, sa], ["job"])[0]).toBe(sa);
  });

  test("ties prefer SA, then NSA when asked", () => {
    const nsa = s("URNS@HON.M", "Unemployment Rate", {
      seasonalAdjustment: "not_seasonally_adjusted",
    });
    const sa = s("UR@HON.M", "Unemployment Rate", {
      seasonalAdjustment: "seasonally_adjusted",
    });
    expect(rankSeries([nsa, sa], ["unemployment"])[0]).toBe(sa);
    expect(rankSeries([sa, nsa], ["unemployment"], "nsa")[0]).toBe(nsa);
  });

  test("then the longer observation range", () => {
    const short = s("A@HI.A", "Jobs", {
      observationStart: "2010-01-01",
      observationEnd: "2020-01-01",
    });
    const long = s("B@HI.A", "Jobs", {
      observationStart: "1970-01-01",
      observationEnd: "2020-01-01",
    });
    expect(rankSeries([short, long], ["job"])[0]).toBe(long);
  });

  test("countTermHits looks across title, name and description", () => {
    expect(
      countTermHits(s("VIS@MAU.M", "Visitor Arrivals"), [
        "visitor",
        "arrival",
        "hotel",
      ]),
    ).toBe(2);
  });
});
