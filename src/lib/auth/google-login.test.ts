import { describe, expect, test } from "bun:test";

import { canUseGoogleLogin, isUhEmail } from "./google-login";
import { canInviteEmail } from "./roles";

describe("isUhEmail", () => {
  test("hawaii.edu and its subdomains", () => {
    expect(isUhEmail("x@hawaii.edu")).toBe(true);
    expect(isUhEmail("  X@Manoa.Hawaii.Edu ")).toBe(true);
  });

  test("everything else", () => {
    expect(isUhEmail("x@gmail.com")).toBe(false);
    expect(isUhEmail("x@hawaii.gov")).toBe(false);
    expect(isUhEmail("x@nothawaii.edu")).toBe(false);
    expect(isUhEmail("x@hawaii.edu.evil.io")).toBe(false);
    expect(isUhEmail("")).toBe(false);
  });
});

describe("canInviteEmail", () => {
  test("any role may invite a hawaii.edu address", () => {
    for (const role of ["external", "fsonly", "internal", "fellow"]) {
      expect(canInviteEmail(role, "x@hawaii.edu")).toBe(true);
    }
  });

  test("only admin and dev may invite other domains", () => {
    expect(canInviteEmail("admin", "x@hawaii.gov")).toBe(true);
    expect(canInviteEmail("dev", "x@gmail.com")).toBe(true);
    for (const role of ["external", "fsonly", "internal", "fellow", ""]) {
      expect(canInviteEmail(role, "x@hawaii.gov")).toBe(false);
      expect(canInviteEmail(role, "x@gmail.com")).toBe(false);
    }
  });
});

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
