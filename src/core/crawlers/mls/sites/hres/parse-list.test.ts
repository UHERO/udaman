import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { MlsParseError } from "../../types";
import { parseList } from "./parse-list";

const FIXTURES = join(import.meta.dir, "fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

interface CardOpts {
  id: string;
  saveMls?: string | null;
  photo?: string | null;
  price?: string;
  href?: string;
}

function card(o: CardOpts): string {
  const href =
    o.href ??
    `https://www.hawaiirealestatesearch.com/listing/${o.id}-1-main-st-hilo-hi-96720/`;
  const save =
    o.saveMls === null
      ? ""
      : `<a class="save action-save" data-save='{"div":"#listing-${o.id}","mls":"${o.saveMls ?? o.id}","feed":"hicentralhisramaui"}'></a>`;
  const img =
    o.photo === null
      ? `<img class="lazy" data-src="https://www.hawaiirealestatesearch.com/img/no-image.jpg" src="/img/util/35mm_landscape.gif">`
      : `<img class="lazy" data-src="${o.photo ?? "https://feed-images.rewhosting.com/his_acortez/Photo/Property/1/1-a-o.jpg"}" src="/img/util/35mm_landscape.gif">`;
  return `<div class=" article column -width-1/3 " id="listing-${o.id}">
    <a class="article__photo hero" href="${href}">${img}</a>
    <div class="article__body"><div class="article__actions">${save}</div>
      <h3><a href="${href}"><span class="condo-address">1 Main St, Hilo</span></a></h3>
      <div class="condo-price-details">${o.price ?? "$529,000             - 1 Beds, 1.00 Baths, 588 Sf"}</div>
      <p class="-text-xs">MLS&reg; # ${o.id}</p>
    </div></div>`;
}

function resultsPage(
  cards: string[],
  counter = "3 Properties Found. Page 1 of 1.",
): string {
  return `<html><body><div id="search-toolbar" class="idx-options-bar"></div>
    <div class="container"><div class="-text-xs">${counter}</div>
    <div class="listings columns ">${cards.join("\n")}</div></div></body></html>`;
}

describe("hres parseList — fixtures", () => {
  test("maui page 1: 48 RAM rows, total 1,875", () => {
    const r = parseList(fixture("list-maui-p1.html"));
    expect(r.totalCount).toBe(1875);
    expect(r.rows).toHaveLength(48);
    expect(r.rows[0]).toEqual({
      mlsNumber: "410851",
      mlsBoard: "RAM",
      status: "unknown",
      listPrice: 699000,
      detailUrl:
        "https://www.hawaiirealestatesearch.com/listing/410851-10-polohina-ln-2-3-napilikahanahonokowai-hi-96761/",
    });
    // Molokai listings ride on the maui walk.
    expect(r.rows[1]).toEqual({
      mlsNumber: "410850",
      mlsBoard: "RAM",
      status: "unknown",
      listPrice: 620000,
      detailUrl:
        "https://www.hawaiirealestatesearch.com/listing/410850-2176-kamehameha-v-hwy-molokai-hi-96748/",
    });
    expect(r.rows[47]).toEqual({
      mlsNumber: "410799",
      mlsBoard: "RAM",
      status: "unknown",
      listPrice: 1198000,
      detailUrl:
        "https://www.hawaiirealestatesearch.com/listing/410799-765-wailupe-dr-wailuku-hi-96793/",
    });
  });

  test("kauai page 10: 48 HIS rows, total 599", () => {
    const r = parseList(fixture("list-kauai-p10.html"));
    expect(r.totalCount).toBe(599);
    expect(r.rows).toHaveLength(48);
    expect(r.rows[0]).toEqual({
      mlsNumber: "727620",
      mlsBoard: "HIS",
      status: "unknown",
      listPrice: 1150000,
      detailUrl:
        "https://www.hawaiirealestatesearch.com/listing/727620-pohaiula-pl-lihue-hi-96766/",
    });
    expect(r.rows[47].mlsNumber).toBe("726336");
    expect(r.rows[47].listPrice).toBe(8500000);
  });

  test.each(["list-maui-p1.html", "list-kauai-p10.html"])(
    "%s: every row is complete, unique and links to its own number",
    (name) => {
      const { rows } = parseList(fixture(name));
      expect(new Set(rows.map((r) => r.mlsNumber)).size).toBe(rows.length);
      for (const r of rows) {
        expect(r.mlsNumber).toMatch(/^\d{6}$/);
        expect(r.status).toBe("unknown");
        expect(r.listPrice).toBeGreaterThan(0);
        expect(r.mlsBoard).not.toBeNull();
        expect(r.detailUrl).toStartWith(
          `https://www.hawaiirealestatesearch.com/listing/${r.mlsNumber}-`,
        );
      }
    },
  );
});

describe("hres parseList — boards", () => {
  test("photo CDN path → board", () => {
    const cdn = "https://feed-images.rewhosting.com";
    const { rows } = parseList(
      resultsPage([
        card({
          id: "202617839",
          photo: `${cdn}/trestle_webapi_plus/PHOTO/Property/1/1-a-o.webp`,
        }),
        card({
          id: "733542",
          photo: `${cdn}/his_acortez/Photo/Property/733542/1-a-o.jpg`,
        }),
        card({
          id: "410851",
          photo: `${cdn}/ramaui/Photo/Property/abc/1-a-o.webp`,
        }),
      ]),
    );
    expect(rows.map((r) => r.mlsBoard)).toEqual(["HBR", "HIS", "RAM"]);
  });

  test("the photo wins over the number shape", () => {
    const { rows } = parseList(
      resultsPage([
        card({
          id: "410851",
          photo:
            "https://feed-images.rewhosting.com/his_acortez/Photo/Property/1/1-a-o.jpg",
        }),
      ]),
    );
    expect(rows[0].mlsBoard).toBe("HIS");
  });

  test("no recognizable photo: 9 digits ⇒ HBR, 6 digits ⇒ null", () => {
    const { rows } = parseList(
      resultsPage([
        card({ id: "202617812", photo: null }),
        card({ id: "733417", photo: null }),
        card({
          id: "410999",
          photo:
            "https://feed-images.rewhosting.com/some_new_feed/Photo/1-a-o.jpg",
        }),
      ]),
    );
    expect(rows.map((r) => r.mlsBoard)).toEqual(["HBR", null, null]);
  });
});

describe("hres parseList — edge cases", () => {
  test("price formats", () => {
    const { rows } = parseList(
      resultsPage([
        card({
          id: "410001",
          price: "$1,484,000 - 2 Beds, 2.00 Baths, 1,460 Sf",
        }),
        card({ id: "410002", price: "$15,000" }),
        card({ id: "410003", price: "Call for price" }),
        card({ id: "410004", price: "" }),
      ]),
    );
    expect(rows.map((r) => r.listPrice)).toEqual([1484000, 15000, null, null]);
  });

  test("duplicate cards are collapsed", () => {
    const { rows } = parseList(
      resultsPage([
        card({ id: "410001" }),
        card({ id: "410002" }),
        card({ id: "410001" }),
      ]),
    );
    expect(rows.map((r) => r.mlsNumber)).toEqual(["410001", "410002"]);
  });

  test("a card whose data-save names another listing → MlsParseError", () => {
    expect(() =>
      parseList(resultsPage([card({ id: "410001", saveMls: "410002" })])),
    ).toThrow(MlsParseError);
  });

  test("a card without data-save is still read from its id", () => {
    const { rows } = parseList(
      resultsPage([card({ id: "410001", saveMls: null })]),
    );
    expect(rows).toHaveLength(1);
  });

  test("detailUrl is omitted when the card has no link to its own number", () => {
    const { rows } = parseList(
      resultsPage([
        card({
          id: "410001",
          href: "https://www.hawaiirealestatesearch.com/listing/410002-other/",
        }),
      ]),
    );
    expect(rows[0]).toEqual({
      mlsNumber: "410001",
      mlsBoard: "HIS",
      status: "unknown",
      listPrice: 529000,
    });
    expect("detailUrl" in rows[0]).toBe(false);
  });

  test("articles outside .listings and ids that are not listings are ignored", () => {
    const html = resultsPage([card({ id: "410001" })]).replace(
      "</body>",
      `<div class="article" id="listing-410777"></div>
       <div class="listings"><div class="article" id="listing-similar_1"></div></div></body>`,
    );
    expect(parseList(html).rows.map((r) => r.mlsNumber)).toEqual(["410001"]);
  });

  test("past-the-end page (toolbar, no counter, no cards) → empty rows", () => {
    expect(parseList(resultsPage([], ""))).toEqual({
      rows: [],
      totalCount: null,
    });
  });

  test("zero-result page keeps its counter", () => {
    expect(parseList(resultsPage([], "0 Properties Found."))).toEqual({
      rows: [],
      totalCount: 0,
    });
  });

  test("singular counter", () => {
    const r = parseList(
      resultsPage([card({ id: "410001" })], "1 Property Found. Page 1 of 1."),
    );
    expect(r.totalCount).toBe(1);
  });

  test("not a results page → MlsParseError", () => {
    expect(() => parseList("<html><body><h1>503</h1></body></html>")).toThrow(
      MlsParseError,
    );
    expect(() => parseList("")).toThrow(MlsParseError);
    expect(() => parseList(fixture("detail-not-found-399999.html"))).toThrow(
      MlsParseError,
    );
  });

  test("a detail page (which has similar-listings cards) is refused, not read", () => {
    expect(() => parseList(fixture("detail-ram-condo-410851.html"))).toThrow(
      MlsParseError,
    );
  });
});
