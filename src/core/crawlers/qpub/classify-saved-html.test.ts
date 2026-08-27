import { openSync, readSync, closeSync, statSync } from "fs";
import path from "path";

import { describe, expect, it } from "bun:test";

import { CLASSIFY_HEAD_BYTES, classifySavedHtml } from "./scrape";

const FIXTURES = path.join(__dirname, "__fixtures__");

/**
 * Read a fixture the way repair reads a NAS file: opening bytes only. The
 * whole point of the classifier is that the verdict is reachable without
 * pulling a 200 KB file over the wire, so the tests must not read more either.
 */
function classifyFixture(name: string) {
  const file = path.join(FIXTURES, name);
  const size = statSync(file).size;
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(CLASSIFY_HEAD_BYTES);
    const bytesRead = readSync(fd, buf, 0, CLASSIFY_HEAD_BYTES, 0);
    return classifySavedHtml(buf.subarray(0, bytesRead).toString("utf-8"), size);
  } finally {
    closeSync(fd);
  }
}

describe("classifySavedHtml", () => {
  const validFixtures = [
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

  for (const name of validFixtures) {
    it(`accepts ${name}`, () => {
      expect(classifyFixture(name)).toBe("valid");
    });
  }

  // Condo-project pages are a different shape but still a successful scrape —
  // repair must not send them back to the queue.
  for (const name of ["oahu-condo-project.html", "maui-condo-project.html"]) {
    it(`accepts condo project ${name}`, () => {
      expect(classifyFixture(name)).toBe("valid");
    });
  }

  // The regression this classifier exists for: parse.ts's detectPageStatus
  // calls this same file "unknown" — it's 32 KB (so it clears the shell check)
  // and carries neither "recaptcha" nor "we're sorry".
  it("catches the Cloudflare interstitial that detectPageStatus misses", () => {
    expect(classifyFixture("captcha.html")).toBe("cloudflare-challenge");
  });

  it("flags a truncated file as a shell", () => {
    expect(classifySavedHtml("<html><body>partial", 812)).toBe("shell");
  });

  it("flags a Cloudflare block page", () => {
    expect(
      classifySavedHtml(
        "<html><title>Attention Required!</title><body>Sorry, you have been blocked</body></html>",
        9_000,
      ),
    ).toBe("cloudflare-block");
  });

  it("flags a qPub reCAPTCHA page", () => {
    expect(
      classifySavedHtml(
        '<html><title>qPublic</title><body><div class="g-recaptcha"></div></body></html>',
        9_000,
      ),
    ).toBe("captcha");
  });

  it("falls through to unknown for an unrecognized page", () => {
    expect(
      classifySavedHtml(
        "<html><title>Site Maintenance</title><body>Back soon</body></html>",
        9_000,
      ),
    ).toBe("unknown");
  });
});
