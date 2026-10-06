import { describe, expect, test } from "bun:test";

import {
  AddressIndex,
  FUZZY_MIN,
  normalizeAddress,
  parcelOf,
  streetSimilarity,
  unitVariants,
} from "./address";

/** Listing spelling ↔ qPublic spelling, as seen in the data; each pair must agree. */
const SAME: [string, string][] = [
  ["1000 Auahi St #3305", "1000 AUAHI ST APT 3305"],
  ["629 Ke'eaumoku St Unit # 1605", "629 KEEAUMOKU ST"],
  ["629 Ke‘eaumoku Street", "629 KE'EAUMOKU ST"],
  ["91-1083 Kekuilani Loop", "91-1083 KEKUILANI LP"],
  ["91-4099 Hikuono St Unit # 1512", "91- 4099 HIKUONO ST UNIT # 1001"],
  ["68-036 Apuhihi Street", "68-36 APUHIHI ST APT A"],
  ["87108 Kaukamana Road", "87-108 KAUKAMANA RD"],
  ["99-1350 Halawa Heights Road", "99-1350 HALAWA HTS RD"],
  ["572-a Kalaheo Avenue", "572 A N KALAHEO AVE"],
  ["3343 Keha Drive", "3343 KEHA DR KIHEI HI 96753"],
  ["517 W Papa Ave", "517 W PAPA AVE KAHULUI HI 96732"],
  ["1212 Nuuanu Ave Apt 2601", "1212 NUUANU AVE 2601"],
  ["15-1852 7th Avenue", "15-1852 7TH AVENUE"],
  ["1100 Ala Moana", "1100 ALA MOANA BLVD"],
  ["95-1061 Alakaina St", "95 1061 ALAKAINA ST MILILANI HI"],
  ["4-820 Kuhio Hwy Apt C106", "4 820 KUHIO HWY APT C106 KAPAA HI"],
  // The vendor's export turned okina into "?". (A "?" that replaced a
  // macron vowel — "Kal?kaua" — can only match fuzzily.)
  ["41-489 Kalaniana?ole Hwy", "41-489 KALANIANAOLE HWY"],
  ["816312 Hawai?i Belt Rd unit Ohana", "81-6312 HAWAII BELT ROAD"],
  ["2112 Mott-smith Drive", "2112 MOTT SMITH DR"],
  ["16-1794 Keaau-pahoa Road", "16-1794 KEAAU PAHOA ROAD"],
  ["312 - B Holua Drive", "312 HOLUA DR KAHULUI HI 96732"],
];

describe("normalizeAddress", () => {
  // Same house: number and street agree (unit and lot may differ).
  const house = (a: string) => {
    const k = normalizeAddress(a);
    return k && { num: k.num, street: k.street };
  };
  test.each(SAME)("%s ≡ %s", (listing, qpub) => {
    expect(house(listing)).not.toBeNull();
    expect(house(qpub)).toEqual(house(listing));
  });

  test("keys", () => {
    expect(normalizeAddress("68-36 APUHIHI ST")).toEqual({
      num: "68036",
      street: "apuhihi",
    });
    expect(normalizeAddress("15-1852 7TH AVENUE")?.street).toBe("7th");
  });

  test("lot letters and units", () => {
    expect(normalizeAddress("85-223 H ALA AKAU STREET WAIANAE HI")).toEqual({
      num: "85223",
      street: "alaakau",
      lot: "h",
    });
    expect(normalizeAddress("1294-A PUHAU ST")?.lot).toBe("a");
    expect(normalizeAddress("1430-2 HUNAKAI ST #104")).toEqual({
      num: "1430",
      street: "hunakai",
      lot: "2",
      unit: "104",
    });
    // The unit agrees across spellings; city and zip are never a unit.
    for (const a of [
      "1001 QUEEN STREET #3713 HONOLULU HI",
      "1001 QUEEN ST APT 3713",
      "1001 Queen St Unit # 3713",
    ])
      expect(normalizeAddress(a)?.unit).toBe("3713");
    expect(normalizeAddress("69-1000 KOLEA KAI CIR #9-K")?.unit).toBe("9k");
    expect(normalizeAddress("84-965 FARRINGTON HWY A/101")?.unit).toBe("a101");
    expect(normalizeAddress("130 KAI MALINA PKWY H340 LAHAINA HI")?.unit).toBe(
      "h340",
    );
    expect(normalizeAddress("130 KAI MALINA PKWY LAHAINA 96761")?.unit).toBe(
      undefined,
    );
    expect(normalizeAddress("3343 KEHA DR KIHEI HI 96753")?.unit).toBe(
      undefined,
    );
  });

  test("Lower Honoapiilani, however abbreviated", () => {
    for (const a of [
      "4531 L HONOAPIILANI RD #33",
      "4531 LWR HONOAPIILANI RD",
      "4531 LOWER HONOAPIILANI RD UNIT C409 LAHAINA HI 96761",
    ])
      expect(normalizeAddress(a)?.street).toBe("lowerhonoapiilani");
  });

  test("no house number → null", () => {
    expect(normalizeAddress("Moanalualani Pl")).toBeNull();
    expect(normalizeAddress("KAPAHULU AVE")).toBeNull();
    expect(normalizeAddress("")).toBeNull();
    expect(normalizeAddress(null)).toBeNull();
  });

  test("different houses stay different", () => {
    expect(normalizeAddress("600 Ala Moana Blvd")).not.toEqual(
      normalizeAddress("602 ALA MOANA BLVD"),
    );
    expect(normalizeAddress("68-36 Apuhihi St")).not.toEqual(
      normalizeAddress("68-360 APUHIHI ST"),
    );
  });
});

describe("streetSimilarity(listing, qpub)", () => {
  // Every fuzzy pairing the 2014–2026 data produced was audited (2026-10-05).
  test.each([
    ["kalnaianaole", "kalanianaole"],
    ["kuawi", "kuaiwi"],
    ["kalkaua", "kalakaua"],
    ["waikloabeach", "waikoloabeach"],
    // qPublic name + junk the vendor glued on
    ["pukihae406", "pukihae"],
    ["kalanianaoleorchidmanor", "kalanianaole"],
    ["alamoanastreets", "alamoana"],
    ["olinostree", "olino"],
  ])("%s ~ %s matches", (listing, qpub) => {
    expect(streetSimilarity(listing, qpub)).toBeGreaterThanOrEqual(FUZZY_MIN);
  });

  test.each([
    // A longer qPublic name is a different street.
    ["makiki", "makikihts"],
    ["palama", "oldpalama"],
    ["honoapiilani", "lowerhonoapiilani"],
    ["kalopa", "kalopalower"],
    // Unrelated / too far apart
    ["kapahulu", "kapiolani"],
    ["keha", "kehe"],
    // Containment needs the qPublic name at the START of the listing's.
    ["laniikena", "ikena"],
  ])("%s ~ %s does not", (listing, qpub) => {
    expect(streetSimilarity(listing, qpub)).toBeLessThan(FUZZY_MIN);
  });
});

describe("AddressIndex", () => {
  test("unit lookup returns the CPR-level TMK", () => {
    const idx = new AddressIndex();
    idx.add("1-2-3-002-106-0412", "1001 QUEEN ST APT 3713");
    idx.add("1-2-3-002-111-0020", "1001 QUEEN ST APT 405");
    expect(idx.unitTmks(normalizeAddress("1001 Queen Street #3713")!)).toEqual(
      new Map([["1-2-3-002-106-0412", "1001 QUEEN ST APT 3713"]]),
    );
    expect(idx.unitTmks(normalizeAddress("1001 Queen St")!)).toBeUndefined();
  });

  test("matchCpr: unit, unit variant, house address — on the matched parcel only", () => {
    const idx = new AddressIndex();
    // A tower: units on one parcel.
    idx.add("1-2-1-005-004-0000", "1519 NUUANU AVE");
    idx.add("1-2-1-005-004-0085", "1519 NUUANU AVE APT 1142");
    idx.add("1-2-1-005-004-0086", "1519 NUUANU AVE APT 1143");
    // The same unit number in two buildings (house numbers) on one parcel.
    idx.add("1-2-6-011-050-0003", "1627 ALA WAI BLVD APT 203");
    idx.add("1-2-6-011-050-0019", "1629 ALA WAI BLVD APT 203");
    // A CPR'd lot of houses, each with its own address.
    idx.add("1-8-7-010-002-0040", "87-2131 PAKEKE ST");
    idx.add("1-8-7-010-002-0041", "87-2133 PAKEKE ST");
    const parcel = "1-2-1-005-004-0000";
    const k = (a: string) => normalizeAddress(a)!;

    expect(idx.matchCpr(parcel, k("1519 Nuuanu Ave #1142"))).toEqual({
      tmk: "1-2-1-005-004-0085",
      address: "1519 NUUANU AVE APT 1142",
      match: "unit",
    });
    expect(
      idx.matchCpr(parcel, k("1519 Nuuanu Ave K1142 King Tower"))?.match,
    ).toBe("unit_variant");
    expect(
      idx.matchCpr("1-8-7-010-002-0000", k("87-2131 Pakeke Street")),
    ).toMatchObject({
      tmk: "1-8-7-010-002-0040",
      match: "house_address",
    });
    // No guess: same unit number in two buildings; a building address shared
    // by every unit; a unit on a different parcel; a non-condo parcel.
    expect(
      idx.matchCpr("1-2-6-011-050-0000", k("1627 Ala Wai Blvd 203")),
    ).toBeNull();
    expect(idx.matchCpr(parcel, k("1519 Nuuanu Ave"))).toBeNull();
    expect(
      idx.matchCpr("1-2-1-005-099-0000", k("1519 Nuuanu Ave #1142")),
    ).toBeNull();
    expect(idx.matchCpr(parcel, k("1519 Nuuanu Ave #9999"))).toBeNull();
  });

  test("unitVariants", () => {
    expect(unitVariants("k1142")).toEqual(["1142"]);
    expect(unitVariants("rm516")).toEqual(["516"]);
    expect(unitVariants("1404a")).toEqual(["1404"]);
    expect(unitVariants("ph8")).toEqual(["8"]);
    expect(unitVariants("3305")).toEqual([]);
  });

  test("indexes CPR rows under their parcel, once per parcel", () => {
    expect(parcelOf("1-2-1-009-011-0351")).toBe("1-2-1-009-011-0000");
    expect(parcelOf("junk")).toBeNull();
    const idx = new AddressIndex();
    idx.add("1-2-1-009-011-0351", "1200 QUEEN EMMA ST APT 3512");
    idx.add("1-2-1-009-011-0352", "1200 QUEEN EMMA ST APT 3513");
    expect(idx.add("1-2-1-009-012-0000", "QUEEN EMMA ST")).toBe(false);
    expect(idx.size).toBe(1);
    expect(idx.streetsWithNumber("1200")?.get("queenemma")).toEqual(
      new Map([["1-2-1-009-011-0000", "1200 QUEEN EMMA ST APT 3512"]]),
    );
  });
});
