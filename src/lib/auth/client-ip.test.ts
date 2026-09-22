import { describe, expect, test } from "bun:test";

import { clientIpFromHeaders } from "./client-ip";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIpFromHeaders", () => {
  test("takes the left-most x-forwarded-for entry (the original client)", () => {
    expect(
      clientIpFromHeaders(
        h({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.7");
  });

  test("handles a single forwarded address", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
  });

  test("falls back to x-real-ip when there is no forwarded chain", () => {
    expect(clientIpFromHeaders(h({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
  });

  test("prefers x-forwarded-for over x-real-ip", () => {
    expect(
      clientIpFromHeaders(
        h({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.4" }),
      ),
    ).toBe("203.0.113.7");
  });

  test("keeps IPv6 addresses intact", () => {
    const v6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    expect(clientIpFromHeaders(h({ "x-forwarded-for": v6 }))).toBe(v6);
    expect(v6.length).toBeLessThanOrEqual(45);
  });

  test("returns null when no address header is present", () => {
    expect(clientIpFromHeaders(h({}))).toBeNull();
  });

  test("returns null for an empty or whitespace-only header", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "   " }))).toBeNull();
    expect(clientIpFromHeaders(h({ "x-real-ip": "" }))).toBeNull();
  });

  test("truncates absurdly long values to the column-safe length", () => {
    const result = clientIpFromHeaders(h({ "x-real-ip": "9".repeat(200) }));
    expect(result).toHaveLength(45);
  });
});
