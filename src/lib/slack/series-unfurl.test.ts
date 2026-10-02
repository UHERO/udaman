import { describe, expect, test } from "bun:test";

import { buildSeriesUnfurlBlocks, parseSeriesLink } from "./series-unfurl";

describe("parseSeriesLink", () => {
  test("subdomain and direct-access forms", () => {
    expect(
      parseSeriesLink("https://udaman.uhero.hawaii.edu/uhero/series/123"),
    ).toBe(123);
    expect(
      parseSeriesLink("http://localhost:3008/udaman/uhero/series/45?x=1"),
    ).toBe(45);
    expect(
      parseSeriesLink(
        "https://udaman.uhero.hawaii.edu/nta/series/9/data-points/2026-01-01",
      ),
    ).toBe(9);
  });

  test("rejects non-series and malformed URLs", () => {
    expect(
      parseSeriesLink("https://udaman.uhero.hawaii.edu/uhero/series"),
    ).toBeNull();
    expect(
      parseSeriesLink("https://udaman.uhero.hawaii.edu/uhero/series/create"),
    ).toBeNull();
    expect(parseSeriesLink("not a url")).toBeNull();
  });
});

const base = {
  id: 1,
  name: "VISNS@HI.M",
  universe: "UHERO",
  title: "Visitor Arrivals <Total>",
  frequency: "month",
  decimals: 0,
  percent: false,
  unitsLabel: "persons",
  geography: "Hawaii",
};

const text = (blocks: unknown[]) =>
  (blocks[0] as { text: { text: string } }).text.text;

describe("buildSeriesUnfurlBlocks", () => {
  test("title, details, latest value and change", () => {
    const t = text(
      buildSeriesUnfurlBlocks({
        ...base,
        latest: [
          { date: new Date("2026-08-01T00:00:00Z"), value: 102_100 },
          { date: new Date("2026-07-01T00:00:00Z"), value: 100_000 },
        ],
      }),
    );
    expect(t).toBe(
      "*Visitor Arrivals &lt;Total&gt;*\n" +
        "`VISNS@HI.M` · Hawaii · Month\n" +
        "*Latest:* 102,100 persons — 2026-08   ▲ 2.1% vs 2026-07",
    );
  });

  test("no data", () => {
    const t = text(
      buildSeriesUnfurlBlocks({ ...base, title: null, latest: [] }),
    );
    expect(t).toBe("`VISNS@HI.M` · Hawaii · Month\n_No data yet_");
  });
});
