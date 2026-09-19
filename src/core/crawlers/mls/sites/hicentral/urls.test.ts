import { describe, expect, test } from "bun:test";

import type { IslandKey } from "../../types";
import {
  detailUrl,
  HICENTRAL_ISLAND_TAILS,
  HICENTRAL_MAX_PAGE,
  listSegments,
  listUrl,
} from "./urls";

const VERIFIED_OAHU_ACTIVE_NEWEST =
  "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood/d//7//145////////1////////////////////////////";

/** Handoff seed URLs: default sort, page 1, status 401. */
const SEEDS: Record<IslandKey, string> = {
  oahu: "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////1////////////////////////////",
  kauai:
    "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////4/15///////////////////////////",
  maui: "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////2/19///////////////////////////",
  lanai:
    "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////6/28///////////////////////////",
  molokai:
    "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////5/96///////////////////////////",
  hawaii:
    "https://propertysearch.hicentral.com/HBR/ForSale/?/Results/Neighborhood///7//401////////3////////////////////////////",
};

const segmentsOf = (url: string) => url.slice(url.indexOf("?") + 1).split("/");

describe("hicentral listUrl", () => {
  test("reproduces the verified working URL byte for byte", () => {
    expect(listUrl({ island: "oahu", statusSet: "active", page: 1 })).toBe(
      VERIFIED_OAHU_ACTIVE_NEWEST,
    );
  });

  test.each(Object.keys(SEEDS) as IslandKey[])(
    "%s: statusSet any differs from the seed URL only in the sort segment",
    (island) => {
      const built = segmentsOf(listUrl({ island, statusSet: "any", page: 1 }));
      const seed = segmentsOf(SEEDS[island]);
      expect(built.length).toBe(seed.length);
      expect(built[3]).toBe("d");
      expect(seed[3]).toBe("");
      built[3] = "";
      expect(built).toEqual(seed);
    },
  );

  test.each(Object.keys(SEEDS) as IslandKey[])(
    "%s: default-sort segments round-trip to the seed URL, tail included",
    (island) => {
      const segs = listSegments({ island, statusSet: "any", page: 1 }, "");
      expect(
        `https://propertysearch.hicentral.com/HBR/ForSale/?${segs.join("/")}`,
      ).toBe(SEEDS[island]);
      expect(
        SEEDS[island].endsWith(`/401${HICENTRAL_ISLAND_TAILS[island]}`),
      ).toBe(true);
    },
  );

  test("segments land in their positional slots", () => {
    const segs = segmentsOf(
      listUrl({ island: "maui", statusSet: "active", page: 37 }),
    );
    expect(segs.slice(0, 8)).toEqual([
      "",
      "Results",
      "Neighborhood",
      "d",
      "37",
      "7",
      "",
      "145",
    ]);
  });

  test("page 1 is the empty segment; other pages are the number", () => {
    const at = (page: number) =>
      segmentsOf(listUrl({ island: "oahu", statusSet: "any", page }))[4];
    expect(at(1)).toBe("");
    expect(at(2)).toBe("2");
    expect(at(HICENTRAL_MAX_PAGE)).toBe("499");
  });

  test("page number never changes the segment count", () => {
    const n = (page: number) =>
      segmentsOf(listUrl({ island: "oahu", statusSet: "any", page })).length;
    expect(n(250)).toBe(n(1));
  });

  test("status sets map to the site's bitmask", () => {
    const status = (statusSet: "active" | "any") =>
      segmentsOf(listUrl({ island: "oahu", statusSet, page: 1 }))[7];
    expect(status("active")).toBe("145");
    expect(status("any")).toBe("401");
  });

  test("rejects pages the site will only redirect", () => {
    const bad = [0, -1, 1.5, Number.NaN, HICENTRAL_MAX_PAGE + 1];
    for (const page of bad) {
      expect(() =>
        listUrl({ island: "oahu", statusSet: "any", page }),
      ).toThrow();
    }
  });

  test("HICENTRAL_MAX_PAGE is 499", () => {
    expect(HICENTRAL_MAX_PAGE).toBe(499);
  });
});

describe("hicentral detailUrl", () => {
  test("builds the MLS-number URL", () => {
    expect(detailUrl("202426768")).toBe(
      "https://propertysearch.hicentral.com/HBR/ForSale/?/202426768",
    );
  });

  test("rejects anything that is not exactly 9 digits", () => {
    for (const bad of [
      "20242676",
      "2024267680",
      "20242676a",
      "",
      " 202426768",
      "../202426768",
    ]) {
      expect(() => detailUrl(bad)).toThrow();
    }
  });
});
