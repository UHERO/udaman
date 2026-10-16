/**
 * The DATABOOK manifest on disk: data-dir/databook/manifest/section<NN>.json
 * (gitignored, ~20 MB). It freezes series names: `sync` always starts
 * from the previous manifest, so keep this directory backed up.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ManifestSection } from "@/core/ingest/sources/databook/manifest";
import { getDataDir } from "@/lib/data-dir";

export function databookDir(): string {
  return join(getDataDir(), "databook");
}

export function manifestDir(): string {
  return join(databookDir(), "manifest");
}

export function writeManifest(
  sections: ManifestSection[],
  dir = manifestDir(),
): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const s of sections) {
    writeFileSync(
      join(dir, `section${String(s.section).padStart(2, "0")}.json`),
      JSON.stringify(s) + "\n",
    );
  }
}

export function readManifest(dir = manifestDir()): ManifestSection[] {
  const out: ManifestSection[] = [];
  for (let i = 1; i <= 24; i++) {
    const f = join(dir, `section${String(i).padStart(2, "0")}.json`);
    if (existsSync(f)) out.push(JSON.parse(readFileSync(f, "utf8")));
  }
  return out;
}
