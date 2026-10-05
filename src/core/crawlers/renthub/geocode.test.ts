import { describe, expect, test } from "bun:test";

import { AddressIndex } from "../address";
import { geocode, searchRadiusM } from "./geocode";
import { ParcelIndex } from "./parcels";

/** A row of 0.0005° (~52 m) square lots along latitude 21.3, lots 001..n. */
const LON0 = -157.8;
const STEP = 0.0005;
const lotTmk = (n: number) => `1-2-3-004-${String(n).padStart(3, "0")}-0000`;

function world(lots: number) {
  const layer = new ParcelIndex();
  for (let n = 1; n <= lots; n++) {
    const x = LON0 + (n - 1) * STEP;
    layer.add(
      {
        division: "1",
        zone: "2",
        section: "3",
        plat1: "004",
        parcel1: String(n).padStart(3, "0"),
        st_areashape: 2700,
      },
      {
        type: "Polygon",
        coordinates: [
          [
            [x, 21.3],
            [x + STEP, 21.3],
            [x + STEP, 21.3 + STEP],
            [x, 21.3 + STEP],
            [x, 21.3],
          ],
        ],
      },
    );
  }
  return layer;
}

/** Centre of lot n. */
const at = (n: number): [number, number] => [
  21.3 + STEP / 2,
  LON0 + (n - 0.5) * STEP,
];

const OPTS = { addressRadiusM: 300, maxNearestM: 0 };

describe("geocode", () => {
  const layer = world(200);
  const addresses = new AddressIndex();
  addresses.add(lotTmk(1), "100 KAPIOLANI BLVD");
  addresses.add(lotTmk(3), "104 KAPIOLANI BLVD APT 5");
  addresses.add(lotTmk(4), "106 KALANIANAOLE HWY");
  addresses.add(lotTmk(150), "900 MAKIKI ST");
  // Same address on two far lots: ambiguous, never address_far.
  addresses.add(lotTmk(120), "500 KEAUNUI DR");
  addresses.add(lotTmk(180), "500 KEAUNUI DR");

  const run = (point: [number, number], address: string | null, dec = 6) =>
    geocode(...point, address, dec, layer, addresses, OPTS);

  test("inside the parcel that carries the address → within_addr", () => {
    expect(run(at(1), "100 Kapiolani Blvd #12")).toEqual({
      tmk: lotTmk(1),
      match: "within_addr",
      distanceM: 0,
      address: "100 KAPIOLANI BLVD",
    });
  });

  test("point on the neighbouring lot → address, moved to the right lot", () => {
    const hit = run(at(2), "104 Kapiolani Boulevard");
    expect(hit?.match).toBe("address");
    expect(hit?.tmk).toBe(lotTmk(3));
    expect(hit!.distanceM).toBeGreaterThan(20);
  });

  test("point in the street → address", () => {
    const hit = run([21.2999, at(3)[1]], "104 Kapiolani Blvd");
    expect(hit).toMatchObject({ tmk: lotTmk(3), match: "address" });
  });

  test("misspelled street, same number → fuzzy", () => {
    expect(run(at(2), "106 Kalnaianaole Hwy")).toMatchObject({
      tmk: lotTmk(4),
      match: "fuzzy",
    });
  });

  test("unique exact address beyond the radius → address_far", () => {
    // Lot 150 is 149 lots × ~52 m ≈ 7.7 km east of lot 1.
    expect(run(at(1), "900 Makiki St")).toMatchObject({
      tmk: lotTmk(150),
      match: "address_far",
    });
  });

  test("ambiguous far address is not used", () => {
    expect(run(at(1), "500 Keaunui Dr")).toMatchObject({
      tmk: lotTmk(1),
      match: "within",
      address: null,
    });
  });

  test("no address / unknown address → the point's parcel, or nothing", () => {
    expect(run(at(5), null)?.match).toBe("within");
    expect(run(at(5), "77 Nowhere St")?.match).toBe("within");
    expect(run([21.29, at(5)[1]], "77 Nowhere St")).toBeNull();
  });

  test("addressRadiusM 0 turns address matching off", () => {
    expect(
      geocode(...at(2), "104 Kapiolani Blvd", 6, layer, addresses, {
        addressRadiusM: 0,
        maxNearestM: 0,
      }),
    ).toMatchObject({ tmk: lotTmk(2), match: "within" });
  });
});

describe("searchRadiusM", () => {
  test("widens for coarse coordinates, capped", () => {
    expect(searchRadiusM(300, 6)).toBe(300);
    expect(searchRadiusM(300, null)).toBe(300);
    expect(searchRadiusM(300, 3)).toBe(300);
    expect(searchRadiusM(300, 2)).toBeCloseTo(1665, 0);
    expect(searchRadiusM(300, 1)).toBe(2000);
  });
});
