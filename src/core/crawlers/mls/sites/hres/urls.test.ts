import { describe, expect, test } from "bun:test";

import type { IslandKey } from "../../types";
import { hresAdapter } from "./index";
import { detailUrl, HRES_ISLAND_SLUGS, HRES_MAX_PAGE, listUrl } from "./urls";

describe("hres listUrl", () => {
  test("page 1 is the bare island path", () => {
    expect(listUrl({ island: "oahu", statusSet: "active", page: 1 })).toBe(
      "https://www.hawaiirealestatesearch.com/mls/oahu/",
    );
  });

  test("later pages add ?p=N", () => {
    expect(listUrl({ island: "maui", statusSet: "active", page: 2 })).toBe(
      "https://www.hawaiirealestatesearch.com/mls/maui/?p=2",
    );
    expect(listUrl({ island: "kauai", statusSet: "active", page: 13 })).toBe(
      "https://www.hawaiirealestatesearch.com/mls/kauai/?p=13",
    );
  });

  test("hawaii is the site's 'big-island'", () => {
    expect(listUrl({ island: "hawaii", statusSet: "active", page: 40 })).toBe(
      "https://www.hawaiirealestatesearch.com/mls/big-island/?p=40",
    );
    expect(HRES_ISLAND_SLUGS).toEqual({
      oahu: "oahu",
      maui: "maui",
      hawaii: "big-island",
      kauai: "kauai",
    });
  });

  test("sold lists exist for hawaii and kauai only", () => {
    expect(listUrl({ island: "kauai", statusSet: "sold", page: 1 })).toBe(
      "https://www.hawaiirealestatesearch.com/mls/kauai_sold/",
    );
    expect(listUrl({ island: "hawaii", statusSet: "sold", page: 328 })).toBe(
      "https://www.hawaiirealestatesearch.com/mls/big-island-sold/?p=328",
    );
    for (const island of ["oahu", "maui", "molokai"] as IslandKey[]) {
      expect(() => listUrl({ island, statusSet: "sold", page: 1 })).toThrow(
        /no sold list/,
      );
    }
    expect(hresAdapter.soldWalkIslands).toEqual(["hawaii", "kauai"]);
  });

  test("'active' and 'any' are the same walk — the island pages only list open listings", () => {
    for (const page of [1, 7]) {
      expect(listUrl({ island: "oahu", statusSet: "any", page })).toBe(
        listUrl({ island: "oahu", statusSet: "active", page }),
      );
    }
  });

  test.each(["molokai", "lanai"] as IslandKey[])(
    "%s has no list page (listed under maui) → throws",
    (island) => {
      expect(() => listUrl({ island, statusSet: "active", page: 1 })).toThrow(
        /under maui/,
      );
    },
  );

  test("rejects pages outside 1..HRES_MAX_PAGE and non-integers", () => {
    expect(HRES_MAX_PAGE).toBe(400);
    const at = (page: number) => () =>
      listUrl({ island: "oahu", statusSet: "active", page });
    expect(at(0)).toThrow();
    expect(at(-1)).toThrow();
    expect(at(1.5)).toThrow();
    expect(at(Number.NaN)).toThrow();
    expect(at(HRES_MAX_PAGE + 1)).toThrow();
    expect(at(HRES_MAX_PAGE)).not.toThrow();
  });
});

describe("hres detailUrl", () => {
  test("number-only URL for every board's number shape", () => {
    expect(detailUrl("202617839")).toBe(
      "https://www.hawaiirealestatesearch.com/listing/202617839/",
    );
    expect(detailUrl("733542")).toBe(
      "https://www.hawaiirealestatesearch.com/listing/733542/",
    );
    expect(detailUrl("41085")).toBe(
      "https://www.hawaiirealestatesearch.com/listing/41085/",
    );
  });

  test("rejects anything that is not 5-9 digits", () => {
    for (const bad of [
      "",
      "1234",
      "1234567890",
      "41085a",
      "410851-10-polohina-ln",
      "../mls/oahu",
      " 410851",
    ]) {
      expect(() => detailUrl(bad)).toThrow(/5-9 digits/);
    }
  });
});

describe("hresAdapter", () => {
  test("static configuration", () => {
    expect(hresAdapter.site).toBe("hres");
    expect(hresAdapter.priority).toBe(50);
    expect(hresAdapter.boards).toEqual(["HBR", "HIS", "RAM"]);
    expect(hresAdapter.islands).toEqual(["oahu", "maui", "hawaii", "kauai"]);
    expect(hresAdapter.maxPage).toBe(HRES_MAX_PAGE);
    // robots.txt Crawl-delay: 5
    expect(hresAdapter.minDelayMs).toBe(5000);
    expect(hresAdapter.followRedirects).toBe(true);
    expect(hresAdapter.goneStatuses).toEqual([404]);
  });

  test("every listed island has a list URL", () => {
    for (const island of hresAdapter.islands) {
      expect(
        hresAdapter.listUrl({ island, statusSet: "active", page: 1 }),
      ).toMatch(/^https:\/\/www\.hawaiirealestatesearch\.com\/mls\/[a-z-]+\/$/);
    }
  });

  test("walkFor: molokai and lanai rows are covered by the maui walk", () => {
    const walkFor = hresAdapter.walkFor!;
    expect(walkFor("Molokai")).toBe("maui");
    expect(walkFor("Lanai")).toBe("maui");
    expect(walkFor("Maui")).toBe("maui");
    expect(walkFor("Hawaii")).toBe("hawaii");
    expect(walkFor("Big Island")).toBe("hawaii");
    expect(walkFor(" big  island ")).toBe("hawaii");
    expect(walkFor("Oahu")).toBe("oahu");
    expect(walkFor("KAUAI")).toBe("kauai");
  });

  test("walkFor: unknown / null → null", () => {
    const walkFor = hresAdapter.walkFor!;
    expect(walkFor(null)).toBeNull();
    expect(walkFor("")).toBeNull();
    expect(walkFor("Niihau")).toBeNull();
    expect(walkFor("constructor")).toBeNull();
  });
});
