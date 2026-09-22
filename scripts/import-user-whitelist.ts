/**
 * Pre-create UDAMAN accounts from scripts/user-whitelist.csv.
 *
 * Accounts are no longer auto-created on first Google sign-in (see the
 * signIn callback in src/lib/auth/index.ts), so an account has to exist
 * before someone can log in. This script seeds them from the CSV:
 *
 *   - CSV columns: `email,fullname`. Emails are trimmed and lower-cased;
 *     duplicate rows are merged, keeping the first non-blank name.
 *   - An email that already has an account is skipped — unless that account
 *     has no name and the CSV supplies one, in which case only the name is
 *     filled in. Existing values are never overwritten.
 *   - New accounts get no password and the role from --role, defaulting to
 *     NEW_USER_ROLE from src/lib/auth/roles.ts. Only gmail.com / hawaii.edu
 *     addresses can sign in that way (UH Login); any other address is
 *     skipped with a warning — create those through the Create Account form
 *     so a password can be set.
 *
 * Usage (from the repo root):
 *   bun run scripts/import-user-whitelist.ts                 # dry run
 *   bun run scripts/import-user-whitelist.ts --execute       # apply
 *   bun run scripts/import-user-whitelist.ts --role fellow --execute
 *   bun run scripts/import-user-whitelist.ts --file other.csv
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import UserCollection from "@catalog/collections/user-collection";

import { canUseGoogleLogin } from "@/lib/auth/google-login";
import { isRole, NEW_USER_ROLE, NEW_USER_UNIVERSE } from "@/lib/auth/roles";

const argv = process.argv.slice(2);
const EXECUTE = argv.includes("--execute");
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const FILE = resolve(flag("--file") ?? "scripts/user-whitelist.csv");
const ROLE = flag("--role") ?? NEW_USER_ROLE;
if (!isRole(ROLE)) {
  console.error(`Unknown role "${ROLE}"`);
  process.exit(1);
}

type Entry = { email: string; name: string | null };

/** Parse the two-column CSV, normalizing and merging duplicate emails. */
function parseWhitelist(text: string): Entry[] {
  const byEmail = new Map<string, Entry>();
  const lines = text.split(/\r?\n/);
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || (i === 0 && line.toLowerCase().startsWith("email"))) continue;
    const comma = line.indexOf(",");
    const email = (comma >= 0 ? line.slice(0, comma) : line)
      .trim()
      .toLowerCase();
    const name =
      comma >= 0
        ? line
            .slice(comma + 1)
            .trim()
            .replace(/^"|"$/g, "")
        : "";
    if (!email.includes("@")) {
      console.warn(`line ${i + 1}: skipping malformed row "${raw}"`);
      continue;
    }
    const existing = byEmail.get(email);
    if (existing) {
      if (!existing.name && name) existing.name = name;
    } else {
      byEmail.set(email, { email, name: name || null });
    }
  }
  return [...byEmail.values()];
}

async function main() {
  const entries = parseWhitelist(readFileSync(FILE, "utf8"));
  console.log(
    `${EXECUTE ? "APPLY" : "DRY RUN"}: ${entries.length} unique emails in ${FILE}; new accounts get role "${ROLE}"\n`,
  );

  const counts = {
    created: 0,
    namedFilled: 0,
    skipped: 0,
    needsPassword: 0,
    failed: 0,
  };

  for (const entry of entries) {
    try {
      const existing = await UserCollection.getByEmail(entry.email);
      if (existing) {
        if (!existing.name?.trim() && entry.name) {
          console.log(`name    ${entry.email}  ->  "${entry.name}"`);
          if (EXECUTE) {
            await UserCollection.update(existing.id, { name: entry.name });
          }
          counts.namedFilled++;
        } else {
          counts.skipped++;
        }
        continue;
      }

      if (!canUseGoogleLogin(entry.email)) {
        console.warn(
          `SKIP    ${entry.email}  can't use UH Login — create it via the Create Account form with a password`,
        );
        counts.needsPassword++;
        continue;
      }

      console.log(`create  ${entry.email}  (${entry.name ?? "no name"})`);
      if (EXECUTE) {
        await UserCollection.create({
          email: entry.email,
          name: entry.name,
          role: ROLE,
          universe: NEW_USER_UNIVERSE,
        });
      }
      counts.created++;
    } catch (e) {
      counts.failed++;
      console.error(
        `FAILED ${entry.email}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  console.log(
    `\n${EXECUTE ? "Done" : "Would apply"}: ${counts.created} created, ${counts.namedFilled} names filled, ${counts.skipped} skipped (already exist), ${counts.needsPassword} skipped (need a password), ${counts.failed} failed`,
  );
  if (!EXECUTE) console.log("Re-run with --execute to apply.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  });
