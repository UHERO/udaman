import { describe, expect, test } from "bun:test";

import { canUseGoogleLogin } from "./google-login";

describe("canUseGoogleLogin", () => {
  test("gmail and hawaii.edu (including subdomains) can", () => {
    expect(canUseGoogleLogin("someone@gmail.com")).toBe(true);
    expect(canUseGoogleLogin("Someone@Hawaii.Edu")).toBe(true);
    expect(canUseGoogleLogin("x@manoa.hawaii.edu")).toBe(true);
    expect(canUseGoogleLogin("  x@hawaii.edu  ")).toBe(true);
  });

  test("other domains and malformed addresses cannot", () => {
    expect(canUseGoogleLogin("x@hawaii.gov")).toBe(false);
    expect(canUseGoogleLogin("x@husky.neu.edu")).toBe(false);
    expect(canUseGoogleLogin("x@nothawaii.edu")).toBe(false);
    expect(canUseGoogleLogin("x@gmail.com.evil.io")).toBe(false);
    expect(canUseGoogleLogin("nope")).toBe(false);
    expect(canUseGoogleLogin("")).toBe(false);
  });
});
