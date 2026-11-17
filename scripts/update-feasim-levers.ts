/**
 * Work out which pathways each lever affects in the installed feasim, save it
 * to src/lib/feasim/generated/lever-pathways.json (which LEVERS reads), and
 * report what changed. Also lists any model input the API neither accepts as
 * a lever nor leaves out on purpose (NOT_LEVERS): new inputs in a release.
 *
 *   bun scripts/update-feasim-levers.ts     (run by `bun run upgrade:feasim`)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import {
  findLeverPathways,
  LEVER_PATHWAYS_FILE,
} from "@/lib/feasim/lever-pathways";
import {
  FEASIM_VERSION,
  LEVERS,
  NOT_LEVERS,
  PROGRAMS,
} from "@/lib/feasim/params";

const ABOUT =
  "Which pathways each lever affects. Made by `bun run upgrade:feasim`; don't edit by hand.";

const saved: Record<string, string[]> = existsSync(LEVER_PATHWAYS_FILE)
  ? JSON.parse(readFileSync(LEVER_PATHWAYS_FILE, "utf8")).levers
  : {};
const found = findLeverPathways();

// ── what changed ─────────────────────────────────────────────────────────
const lines: string[] = [];
for (const [name, now] of Object.entries(found)) {
  const before = saved[name];
  if (!before) {
    lines.push(`  + ${name}: ${now.join(", ") || "no pathway"}`);
    continue;
  }
  const added = now.filter((p) => !before.includes(p));
  const removed = before.filter((p) => !(now as string[]).includes(p));
  if (removed.length)
    lines.push(`  ${name}: no longer applies to ${removed.join(", ")}`);
  if (added.length) lines.push(`  ${name}: now applies to ${added.join(", ")}`);
  if (!now.length)
    lines.push(`  ! ${name}: changes no pathway now; drop it or check feasim`);
}
for (const name of Object.keys(saved))
  if (!(name in found)) lines.push(`  - ${name}: no longer a lever`);

writeFileSync(
  LEVER_PATHWAYS_FILE,
  `${JSON.stringify({ _about: ABOUT, _feasim_version: FEASIM_VERSION, levers: found }, null, 2)}\n`,
);
console.log(
  `Lever pathways (${Object.keys(found).length} levers, ${PROGRAMS.length} pathways):\n${
    lines.length ? lines.join("\n") : "  no changes"
  }`,
);

// ── model inputs the API doesn't handle ──────────────────────────────────
// SliderInputs is a type, so read its fields from feasim's type declarations.
const dts = readFileSync("node_modules/@uhero/feasim/dist/index.d.ts", "utf8");
const body = dts.match(/interface SliderInputs \{([\s\S]*?)\n\}/)?.[1];
if (!body) {
  console.log(
    "\nModel inputs: couldn't find SliderInputs in feasim's types; check by hand.",
  );
} else {
  const fields = [...body.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]);
  const unhandled = fields.filter((f) => !(f in LEVERS) && !(f in NOT_LEVERS));
  console.log(
    unhandled.length
      ? `\nModel inputs the API doesn't accept yet (add a lever, or list it in NOT_LEVERS in params.ts):\n${unhandled.map((f) => `  ${f}`).join("\n")}`
      : "\nModel inputs: all handled",
  );
}
