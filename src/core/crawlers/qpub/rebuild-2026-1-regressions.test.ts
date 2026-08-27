/**
 * Regressions from the 2026-1 rebuild.
 *
 * That run reported 10,246 "Parse returned non-success status" errors against
 * 600,375 files. Re-classifying every one of them found four distinct page
 * shapes collapsed into a single opaque bucket, one of which was a parser bug
 * discarding complete profiles. Each is pinned here.
 *
 * Fixture-free by design: these are shapes, not pages, and reproducing them
 * from the marker text keeps the checks readable next to the code they guard.
 */

import { readFileSync } from "fs";
import path from "path";

import { describe, expect, it } from "bun:test";

import { unitParcelToTmk } from "@/core/workers/processors/qpub-load";

import { tmkFromParcelNumber, tmkToParcelNumber } from "./config";
import { parsePropertyHTML } from "./parse";
import { NO_RECORD_TAIL_BYTES } from "./parse-utils";
import { classifySavedHtml, CLASSIFY_HEAD_BYTES } from "./scrape";

const FIXTURES = path.join(__dirname, "__fixtures__");

function load(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf-8");
}

/** Classify the way repair does: opening bytes plus closing bytes, never the middle. */
function classifyEnds(html: string): ReturnType<typeof classifySavedHtml> {
  return classifySavedHtml(
    html.slice(0, CLASSIFY_HEAD_BYTES),
    html.length,
    html.slice(-NO_RECORD_TAIL_BYTES),
  );
}

const PADDING = "x".repeat(60_000);

// ─── 2,318 files: the "Parcel  Number" label ────────────────────────

describe('double-spaced "Parcel  Number" label', () => {
  // qPublic serves this label with two spaces on a minority of Oahu pages.
  // detectPageStatus matched the raw textContent against a single space, so
  // every such page fell through to "unknown" and was dropped whole — 2,318 of
  // them, overwhelmingly ordinary residential parcels carrying full owner,
  // assessment, land and sales data.
  const page = (label: string) =>
    `<html><head><title>qPublic - City and County of Honolulu, HI - Report: 110030590037</title></head>` +
    `<body><table><tr><th><strong>${label}</strong></th><td>110030590037</td></tr></table>${PADDING}</body></html>`;

  it("accepts the double-spaced label", () => {
    expect(parsePropertyHTML(page("Parcel  Number"), "1-1-1-003-059-0037").status).toBe(
      "success",
    );
  });

  it("still accepts the ordinary single-spaced label", () => {
    expect(parsePropertyHTML(page("Parcel Number"), "1-1-1-003-059-0037").status).toBe(
      "success",
    );
  });

  // Newlines and tabs between the words are the same failure in another coat.
  it("accepts the label broken across lines", () => {
    expect(
      parsePropertyHTML(page("Parcel\n\tNumber"), "1-1-1-003-059-0037").status,
    ).toBe("success");
  });

  it("does not accept a page with no parcel label at all", () => {
    expect(
      parsePropertyHTML(page("Location Address"), "1-1-1-003-059-0037").status,
    ).toBe("unknown");
  });
});

// ─── 7,806 files: phantom parcels with an empty Parcel Information ──

describe("phantom parcel whose Parcel Information module is empty", () => {
  // The no_record branch used to sit behind "does a <strong> say Parcel
  // Number" — but on a phantom page the module renders empty, so there is no
  // label and no row. Every one of these reported "unknown", indistinguishable
  // from a genuine parse failure.
  const phantom =
    `<html><head><title>qPublic - City and County of Honolulu, HI - Report: 110010010001</title></head>` +
    `<body><table><caption>Parcel Information</caption></table>${PADDING}` +
    `<div><strong>No data available for the following modules:</strong>\n    ` +
    `Parcel Information, Owner Information, Assessment Information.</div></body></html>`;

  it("detectPageStatus returns no_record, not unknown", () => {
    expect(parsePropertyHTML(phantom, "1-1-1-001-001-0001").status).toBe(
      "no_record",
    );
  });

  it("classifySavedHtml agrees", () => {
    expect(classifyEnds(phantom)).toBe("no-record");
  });
});

// ─── 38 files: "No results match your search criteria" ──────────────

describe("TMK qPublic cannot resolve at all", () => {
  // Same report shell, but the title loses its ": <parcel>" suffix and the
  // body is replaced by the search page's notice. A real answer — re-scraping
  // can only ever return the same page — so it must be distinguishable from a
  // transient failure rather than lumped into "unknown".
  const noResults =
    `<html><head><title>\n\tqPublic - Maui County,  HI - Report\n</title></head>` +
    `<body>${PADDING}<div>No results match your search criteria.</div>` +
    `<div>Click here to return to search page.</div></body></html>`;

  it("detectPageStatus returns no_results", () => {
    expect(parsePropertyHTML(noResults, "2-5-2-030-018-0000").status).toBe(
      "no_results",
    );
  });

  it("classifySavedHtml returns no-results", () => {
    expect(classifyEnds(noResults)).toBe("no-results");
  });

  // Without the tail the marker is out of reach; guessing here would retire a
  // real parcel, so the classifier must fall through instead.
  it("classifySavedHtml does not guess no-results from the head alone", () => {
    expect(classifySavedHtml(noResults.slice(0, CLASSIFY_HEAD_BYTES), noResults.length)).not.toBe(
      "no-results",
    );
  });
});

// ─── 84 files: qPublic's own refusal page ───────────────────────────

describe("qPublic authorization refusal", () => {
  // ~95 KB, so it clears the shell check, and it carries none of Cloudflare's
  // markers. Both the parser and the classifier called it "unknown", which
  // meant repair never recognised it as a page worth fetching again.
  const denied =
    `<html><head><title>You are not authorized</title></head>` +
    `<body><img src="data:image/png;base64,AAAA">${PADDING}</body></html>`;

  it("detectPageStatus returns unauthorized", () => {
    expect(parsePropertyHTML(denied, "1-1-6-019-063-0000").status).toBe(
      "unauthorized",
    );
  });

  it("classifySavedHtml returns unauthorized", () => {
    expect(classifyEnds(denied)).toBe("unauthorized");
  });
});

// ─── Condo unit TMKs come from the roster, never from the master ────

describe("unit TMKs are read, not constructed", () => {
  // The roster prints a full parcel number per row. Keeping only its last four
  // characters and grafting them onto the master looks equivalent — on an
  // ordinary master every row shares the master's base — and is not.
  it("reads the row's own base, not the master's", () => {
    // 1-8-4-021-006-0000 (a dropped master) lists 290040010056, which is
    // 1-2-9-004-001-0056 — a parcel in another zone entirely.
    expect(unitParcelToTmk("1-8-4-021-006-0000", "290040010056")).toBe(
      "1-2-9-004-001-0056",
    );
  });

  it("is a no-op on an ordinary master, where the bases agree", () => {
    expect(unitParcelToTmk("1-2-7-013-008-0000", "270130080144")).toBe(
      "1-2-7-013-008-0144",
    );
  });

  // Eleven distinct parcels on that roster end in 0001. Grafting collapsed
  // them onto a single fabricated TMK; reading keeps them apart.
  it("keeps rows with the same CPR distinct", () => {
    const master = "1-8-4-021-006-0000";
    const derived = ["150290770001", "170390010001", "330051080001"].map((p) =>
      unitParcelToTmk(master, p),
    );
    expect(new Set(derived).size).toBe(3);
  });

  // State and Hawaiian Home Lands parcels carry a five-character CPR. A fixed
  // four-character suffix truncated "0000A" to "000A" — a different parcel.
  it("keeps a five-character CPR whole", () => {
    expect(unitParcelToTmk("1-8-4-021-006-0000", "410180480000A")).toBe(
      "1-4-1-018-048-0000A",
    );
  });

  it("refuses a parcel number it cannot read rather than guessing", () => {
    expect(unitParcelToTmk("1-8-4-021-006-0000", "9413000281")).toBeNull();
    expect(unitParcelToTmk("1-8-4-021-006-0000", "")).toBeNull();
    expect(unitParcelToTmk("1-8-4-021-006-0000", "27013008-144")).toBeNull();
  });

  it("round-trips tmkToParcelNumber for every island", () => {
    for (const tmk of [
      "1-1-1-003-059-0037",
      "2-3-8-046-010-0050",
      "3-8-1-007-017-0000",
      "4-3-2-001-007-0001",
    ]) {
      const island = tmk.split("-")[0];
      expect(tmkFromParcelNumber(tmkToParcelNumber(tmk), island)).toBe(tmk);
    }
  });
});

// ─── No fixture may be re-classified by any of the above ────────────

describe("committed fixtures keep their verdicts", () => {
  const valid = [
    "oahu-residential.html",
    "oahu-condo.html",
    "oahu-condo-unit.html",
    "oahu-apartment-building.html",
    "maui-residential.html",
    "maui-condo-unit.html",
    "maui-apartment-building.html",
    "1-3-3-038-040-0000.html",
    "2-4-2-004-028-0000.html",
    "3-8-1-007-017-0000.html",
    "4-3-2-001-007-0001.html",
  ];

  for (const name of valid) {
    it(`${name} stays valid`, () => {
      expect(classifyEnds(load(name))).toBe("valid");
    });
  }
});
