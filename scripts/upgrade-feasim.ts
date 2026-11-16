/**
 * Upgrade the feasim model in one step:
 *
 *   bun run upgrade:feasim 0.5.0
 *
 * 1. installs @uhero/feasim at that exact version (package.json and bun.lock;
 *    FEASIM_VERSION reads package.json);
 * 2. downloads the matching test fixtures from UHERO/feasim's v<version> tag
 *    (scripts/update-feasim-fixtures.ts);
 * 3. runs the feasim tests.
 *
 * It changes files but commits nothing: review the fixture diff and any test
 * failures (a new model version can legitimately change results), then
 * commit.
 */
import { spawnSync } from "node:child_process";

const version = process.argv[2]?.replace(/^v/, "");
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: bun run upgrade:feasim <version>   e.g. 0.5.0");
  process.exit(1);
}

function run(title: string, cmd: string, args: string[]) {
  console.log(`\n── ${title}\n$ ${cmd} ${args.join(" ")}`);
  return spawnSync(cmd, args, { stdio: "inherit" }).status === 0;
}

if (!run("Install", "bun", ["add", `@uhero/feasim@${version}`, "--exact"]))
  process.exit(1);
if (
  !run("Download test fixtures", "bun", ["scripts/update-feasim-fixtures.ts"])
)
  process.exit(1);
const passed = run("Test", "bun", ["test", "src/lib/feasim"]);

console.log(`
── feasim ${version}: ${passed ? "tests pass" : "TESTS FAIL"}
Next:
  - the fixture summary above          what the new version changed
  - bun run report:feasim              compare results; its Snapshots section
                                       shows which API responses changed
  - bun run snapshot:feasim            save those responses, once they're right
  - check feasim's release notes for new inputs or changed defaults
    (lever descriptions in src/lib/feasim/params.ts quote some defaults)
  - commit package.json, bun.lock, the fixtures and the snapshots together`);
process.exit(passed ? 0 : 1);
