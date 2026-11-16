import { afterAll, beforeAll, expect, test } from "bun:test";

import { setApiKeyLookup } from "./auth";
import {
  diffJson,
  loadSnapshots,
  SNAPSHOT_CASES,
  takeSnapshot,
} from "./snapshot-cases";

// a stand-in for api_applications, so the snapshots need no database
beforeAll(() =>
  setApiKeyLookup(async (k) =>
    k === "snapshot"
      ? [{ id: 1, name: "snapshot", hostname: null, universe: "UHERO" }]
      : [],
  ),
);
afterAll(() => setApiKeyLookup());

const saved = loadSnapshots();
const UPDATE = "bun run snapshot:feasim";

test.each(SNAPSHOT_CASES.map((c) => [c.name, c] as const))(
  "API snapshot: %s",
  async (name, c) => {
    expect(
      saved[name],
      `no saved snapshot for "${name}": run \`${UPDATE}\``,
    ).toBeDefined();
    const changes = diffJson(saved[name], await takeSnapshot(c));
    expect(
      changes,
      `"${name}" changed. See it with \`bun run report:feasim\`; if intended, run \`${UPDATE}\``,
    ).toEqual([]);
  },
);

test("no saved snapshots for cases that no longer exist", () => {
  const names = new Set(SNAPSHOT_CASES.map((c) => c.name));
  expect(
    Object.keys(saved).filter((n) => !names.has(n)),
    `remove them with \`${UPDATE}\``,
  ).toEqual([]);
});
