/**
 * Save the feasim API's current responses as its snapshots, after reviewing
 * what changed (bun run report:feasim):
 *
 *   bun run snapshot:feasim
 *
 * Prints which snapshots changed, then rewrites
 * src/lib/feasim/__snapshots__/api-responses.json. Commit it with the change
 * that caused it.
 */
import { setApiKeyLookup } from "@/lib/feasim/auth";
import { setRateLimit } from "@/lib/feasim/rate-limit";
import {
  diffJson,
  loadSnapshots,
  saveSnapshots,
  SNAPSHOT_CASES,
  SNAPSHOT_FILE,
  takeSnapshot,
  type Snapshot,
} from "@/lib/feasim/snapshot-cases";

setApiKeyLookup(async (k) =>
  k === "snapshot"
    ? [{ id: 0, name: "snapshot", hostname: null, universe: "UHERO" }]
    : [],
);
// snapshots record responses, not rate-limit counts
setRateLimit(0);

const saved = loadSnapshots();
const next: Record<string, Snapshot> = {};
const lines: string[] = [];

/** A value short enough for one line of the summary. */
const short = (v: unknown) => {
  const s = v === undefined ? "(none)" : JSON.stringify(v);
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
};
const SHOWN = 4;

for (const c of SNAPSHOT_CASES) {
  next[c.name] = await takeSnapshot(c);
  if (!saved[c.name]) {
    lines.push(`  + new      ${c.name}`);
    continue;
  }
  const changes = diffJson(saved[c.name], next[c.name]);
  if (!changes.length) continue;
  lines.push(`  ~ changed  ${c.name}`);
  for (const ch of changes.slice(0, SHOWN))
    lines.push(
      `      ${ch.path.replace(/^body\./, "")}: ${short(ch.saved)} → ${short(ch.current)}`,
    );
  if (changes.length > SHOWN)
    lines.push(`      … and ${changes.length - SHOWN} more`);
}
for (const name of Object.keys(saved))
  if (!next[name]) lines.push(`  - removed  ${name}`);

saveSnapshots(next);
console.log(
  `${SNAPSHOT_FILE}\n${SNAPSHOT_CASES.length} snapshots${
    lines.length ? `:\n${lines.join("\n")}` : ", none changed"
  }`,
);
