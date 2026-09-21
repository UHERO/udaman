import { describe, expect, test } from "bun:test";

import { DB_RETRY_WAITS_MS, isDbConnectionError, resilient } from "./db-retry";

const closed = () => new Error("Connection closed");

describe("resilient", () => {
  test("REGRESSION 2026-09-20: a DB outage pauses the run and then carries on", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const load = resilient(
      "loadListing",
      async (n: string) => {
        if (++calls <= 3) throw closed();
        return `loaded ${n}`;
      },
      async (ms) => void sleeps.push(ms),
    );
    expect(await load("732468")).toBe("loaded 732468");
    expect(calls).toBe(4);
    expect(sleeps).toEqual(DB_RETRY_WAITS_MS.slice(0, 3));
  });

  test("gives up after the last wait and surfaces the original error", async () => {
    const sleeps: number[] = [];
    const load = resilient(
      "x",
      async () => {
        throw closed();
      },
      async (ms) => void sleeps.push(ms),
    );
    await expect(load()).rejects.toThrow("Connection closed");
    expect(sleeps).toEqual(DB_RETRY_WAITS_MS);
  });

  test("a non-connection error is not retried", async () => {
    let calls = 0;
    const load = resilient(
      "x",
      async () => {
        calls++;
        throw new Error("Data too long for column 'zoning'");
      },
      async () => {},
    );
    await expect(load()).rejects.toThrow("Data too long");
    expect(calls).toBe(1);
  });

  test("recognises the driver's connection failures", () => {
    for (const m of [
      "Connection closed",
      "Connection lost",
      "read ECONNRESET",
      "MySQL server has gone away",
    ]) {
      expect(isDbConnectionError(new Error(m))).toBe(true);
    }
    expect(
      isDbConnectionError(
        Object.assign(new Error("x"), { code: "ECONNREFUSED" }),
      ),
    ).toBe(true);
    expect(isDbConnectionError(new Error("Duplicate entry"))).toBe(false);
    expect(isDbConnectionError("Connection closed")).toBe(false);
  });
});
