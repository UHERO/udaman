import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

import { describe, expect, test } from "bun:test";

import { ParcelIndex, parcelTmk } from "./parcels";

/** Axis-aligned square ring with its lower-left corner at (lon, lat). */
const square = (lon: number, lat: number, size: number) => [
  [lon, lat],
  [lon + size, lat],
  [lon + size, lat + size],
  [lon, lat + size],
  [lon, lat],
];

const props = (parcel: string, area: number) => ({
  division: "1",
  zone: "2",
  section: "3",
  plat1: "004",
  parcel1: parcel,
  st_areashape: area,
});

function build() {
  const idx = new ParcelIndex();
  // A: 0.001° square (~100 m) with a hole in the middle.
  idx.add(props("001", 10_000), {
    type: "Polygon",
    coordinates: [
      square(-157.8, 21.3, 0.001),
      square(-157.7996, 21.3004, 0.0002),
    ],
  });
  // B: small parcel overlapping A's corner — smaller, so it wins there.
  idx.add(props("002", 100), {
    type: "Polygon",
    coordinates: [square(-157.8, 21.3, 0.0001)],
  });
  // C: multipolygon, second part off to the east.
  idx.add(props("003", 500), {
    type: "MultiPolygon",
    coordinates: [
      [square(-157.79, 21.3, 0.0002)],
      [square(-157.78, 21.3, 0.0002)],
    ],
  });
  return idx;
}

describe("parcelTmk", () => {
  test("formats I-Z-S-PPP-PPP-0000 and rejects malformed parts", () => {
    expect(parcelTmk(props("053", 1))).toBe("1-2-3-004-053-0000");
    expect(parcelTmk({ ...props("53", 1) })).toBeNull();
    expect(parcelTmk({ ...props("053", 1), division: "9" })).toBeNull();
  });
});

describe("ParcelIndex.locate", () => {
  const idx = build();

  test("point inside a parcel", () => {
    expect(idx.locate(21.3008, -157.7992, 50)).toEqual({
      tmk: "1-2-3-004-001-0000",
      match: "within",
      distanceM: 0,
    });
  });

  test("overlap: the smallest parcel wins", () => {
    expect(idx.locate(21.30005, -157.79995, 50)?.tmk).toBe(
      "1-2-3-004-002-0000",
    );
  });

  test("a hole is not inside; it takes the nearest edge", () => {
    const hit = idx.locate(21.3005, -157.7995, 50);
    expect(hit?.match).toBe("nearest");
    expect(hit?.tmk).toBe("1-2-3-004-001-0000");
    expect(hit!.distanceM).toBeGreaterThan(5);
    expect(hit!.distanceM).toBeLessThan(15);
  });

  test("every part of a multipolygon counts", () => {
    expect(idx.locate(21.3001, -157.7799, 50)?.tmk).toBe("1-2-3-004-003-0000");
  });

  test("nearest only within the cutoff", () => {
    // ~22 m north of A's top edge (21.301).
    const near = idx.locate(21.3012, -157.7995, 50);
    expect(near?.match).toBe("nearest");
    expect(near!.distanceM).toBeCloseTo(22.1, 0);
    expect(idx.locate(21.3012, -157.7995, 10)).toBeNull();
    expect(idx.locate(21.3012, -157.7995, 0)).toBeNull();
    expect(idx.locate(41.9, -91.6, 50)).toBeNull();
  });
});

describe("ParcelIndex.fromGeojson", () => {
  test("reads one Feature per line, as GDAL writes it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "renthub-parcels-"));
    const file = path.join(dir, "tmks.geojson");
    const feature = (parcel: string, lon: number) =>
      JSON.stringify({
        type: "Feature",
        properties: props(parcel, 1),
        geometry: { type: "Polygon", coordinates: [square(lon, 21.3, 0.001)] },
      });
    writeFileSync(
      file,
      [
        "{",
        '"type": "FeatureCollection",',
        '"features": [',
        feature("010", -157.8) + ",",
        feature("011", -157.7),
        "]",
        "}",
        "",
      ].join("\n"),
    );
    const idx = await ParcelIndex.fromGeojson(file);
    expect(idx.size).toBe(2);
    expect(idx.locate(21.3005, -157.6995, 0)?.tmk).toBe("1-2-3-004-011-0000");
  });
});
