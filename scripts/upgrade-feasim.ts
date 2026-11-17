/**
 * Upgrade the feasim model in one step:
 *
 *   bun run upgrade:feasim 0.6.0
 *
 * 1. installs @uhero/feasim at that exact version (package.json, bun.lock;
 *    FEASIM_VERSION reads package.json);
 * 2. downloads the matching test fixtures from UHERO/feasim's v<version> tag;
 * 3. works out which pathways each lever now affects, and lists any new
 *    model inputs the API doesn't accept yet;
 * 4. saves the API snapshots, listing every response that changed;
 * 5. runs the feasim tests.
 *
 * Each step prints what changed. Nothing is committed: review the summaries
 * (and `git diff`), then commit everything together.
 */
import { spawnSync } from "node:child_process";

const version = process.argv[2]?.replace(/^v/, "");
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: bun run upgrade:feasim <version>   e.g. 0.6.0");
  process.exit(1);
}

/** Run a step in its own process, so it loads the newly installed model. */
function run(title: string, args: string[]) {
  console.log(`\n── ${title}`);
  return spawnSync("bun", args, { stdio: "inherit" }).status === 0;
}

const steps: [string, string[]][] = [
  ["Install", ["add", `@uhero/feasim@${version}`, "--exact"]],
  ["Test fixtures", ["scripts/update-feasim-fixtures.ts"]],
  ["Levers", ["scripts/update-feasim-levers.ts"]],
  ["API snapshots", ["scripts/update-feasim-snapshots.ts"]],
];
for (const [title, args] of steps)
  if (!run(title, args)) {
    console.error(`\n${title} failed; stopped. Fix it, then run this again.`);
    process.exit(1);
  }
const passed = run("Tests", ["test", "src/lib/feasim"]);

console.log(`
── feasim ${version}: ${passed ? "tests pass" : "TESTS FAIL"}
Review the summaries above, then:
  - check that changed results make sense (git diff src/lib/feasim, or
    bun run report:feasim for the side-by-side view)
  - add any new model input listed under Levers, or list it in NOT_LEVERS
  - skim feasim's release notes for changed defaults that lever
    descriptions in src/lib/feasim/params.ts quote
  - commit package.json, bun.lock and src/lib/feasim together`);
process.exit(passed ? 0 : 1);
