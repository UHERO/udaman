import { describe, expect, it } from "bun:test";

import ClientDataFileReader from "./client-data-file-reader";

const CSV = `time,TGBNS@HI.M,ge-base-subtotal1@hi.m,liab-ge-base-use-4@unk.m
2024-05-01,100,40,7
2024-06-01,110,,8
2024-07-01,120,45,9
`;

describe("ClientDataFileReader header matching", () => {
  const reader = ClientDataFileReader.fromCSV(CSV);

  it("matches series names case-insensitively", () => {
    expect([...reader.series("tgbns@hi.m").values()]).toEqual([100, 110, 120]);
  });

  it("finds slugged (hyphenated) headers by their underscore series name", () => {
    const data = reader.series("GE_BASE_SUBTOTAL1@HI.M");
    expect([...data.entries()]).toEqual([
      ["2024-05-01", 40],
      ["2024-07-01", 45],
    ]);
    expect(reader.series("LIAB_GE_BASE_USE_4@UNK.M").get("2024-06-01")).toBe(8);
  });

  it("still finds slugged headers by their literal spelling", () => {
    expect(reader.series("ge-base-subtotal1@hi.m").get("2024-07-01")).toBe(45);
  });

  it("prefers an exact header over a hyphen alias", () => {
    const both = ClientDataFileReader.fromCSV(
      "time,a-b@hi.m,A_B@HI.M\n2024-05-01,1,2\n2024-06-01,1,2\n",
    );
    expect(both.series("A_B@HI.M").get("2024-05-01")).toBe(2);
  });
});
