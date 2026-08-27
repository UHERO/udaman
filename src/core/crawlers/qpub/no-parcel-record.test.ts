import { readFileSync, readdirSync } from "fs";
import path from "path";

import { describe, expect, it } from "bun:test";

import { parsePropertyHTML } from "./parse";
import { hasNoParcelRecord } from "./parse-utils";
import { classifySavedHtml } from "./scrape";

const FIXTURES = path.join(__dirname, "__fixtures__");

function load(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf-8");
}

/**
 * qPublic's footer notice, reproduced in the shape it appears in the raw HTML:
 * the module list is plain text immediately after a </strong>.
 */
function notice(modules: string): string {
  return `<p><strong>No data available for the following modules:</strong>\n    ${modules}.</p>`;
}

const PHANTOM_MODULES =
  "Parcel Information, Owner Information, Condominium/Apartment Unit Information, " +
  "Assessment Information, Dedications, Appeal Information, Land Information";

const SPARSE_BUT_REAL_MODULES =
  "Condominium/Apartment Unit Information, Dedications, Appeal Information, " +
  "Agricultural Assessment Information, Commercial Improvement Information";

describe("hasNoParcelRecord", () => {
  it("flags a notice that lists Parcel Information", () => {
    expect(hasNoParcelRecord(notice(PHANTOM_MODULES))).toBe(true);
  });

  // The distinction the whole check rests on: a real profile is allowed to be
  // missing plenty of optional modules — just never the parcel itself.
  it("spares a notice listing only optional modules", () => {
    expect(hasNoParcelRecord(notice(SPARSE_BUT_REAL_MODULES))).toBe(false);
  });

  it("spares a page with no notice at all", () => {
    expect(hasNoParcelRecord("<html><body>nothing here</body></html>")).toBe(
      false,
    );
  });

  // "Parcel Information" is a section heading on real profiles, so the scan is
  // bounded to the notice — a later occurrence must not leak in.
  it("ignores Parcel Information appearing outside the notice", () => {
    const html =
      notice(SPARSE_BUT_REAL_MODULES) +
      "x".repeat(2000) +
      "<h2>Parcel Information</h2>";
    expect(hasNoParcelRecord(html)).toBe(false);
  });

  // Every committed fixture is a real page; none may trip the check.
  const fixtures = readdirSync(FIXTURES).filter((f) => f.endsWith(".html"));
  for (const name of fixtures) {
    it(`spares fixture ${name}`, () => {
      expect(hasNoParcelRecord(load(name))).toBe(false);
    });
  }
});

describe("phantom parcels are not reported as success", () => {
  // A phantom page keeps the report title and the words "Parcel Number", so
  // every cheaper signal calls it a success. Only the footer notice differs.
  const phantom =
    `<html><head><title>qPublic - City and County of Honolulu, HI - Report: 110350030000</title></head>` +
    `<body><strong>Parcel Number</strong>${"x".repeat(60_000)}${notice(PHANTOM_MODULES)}</body></html>`;

  it("detectPageStatus returns no_record, not success", () => {
    expect(parsePropertyHTML(phantom, "1-1-1-035-003-0000").status).toBe(
      "no_record",
    );
  });

  it("classifySavedHtml returns no-record when given the tail", () => {
    expect(classifySavedHtml(phantom, phantom.length, phantom)).toBe(
      "no-record",
    );
  });

  // Without the tail the classifier can't know — it must not guess "no-record"
  // and retire a real parcel.
  it("classifySavedHtml falls back to valid without a tail", () => {
    expect(classifySavedHtml(phantom, phantom.length)).toBe("valid");
  });

  it("leaves a genuine profile classified valid", () => {
    const real = load("oahu-residential.html");
    expect(classifySavedHtml(real, real.length, real)).toBe("valid");
  });
});
