import { existsSync, readdirSync } from "fs";

/**
 * Auto-detect the NAS scrapes root — the `.../work/scrapes` directory — on
 * mac / linux / windows. Shared by every crawler that keeps raw HTML on the
 * NAS (qpub, mls).
 *
 * `envOverride` is the VALUE of the caller's own override variable (e.g.
 * `process.env.QPUB_NAS_PATH`), not its name: a non-blank value wins over the
 * search and is returned trimmed. That is for a machine that mounts the share
 * somewhere unusual, and for running against a local copy.
 *
 * When nothing is mounted the platform default is returned anyway, so callers
 * get a stable path to report in their "NAS not mounted" error.
 */
export function findScrapesRoot(envOverride?: string): string {
  const override = envOverride?.trim();
  if (override) return override;

  const platform = process.platform;

  if (platform === "darwin") {
    const defaultPath = "/Volumes/UHEROroot/work/scrapes";
    if (existsSync(defaultPath)) return defaultPath;

    try {
      for (const volume of readdirSync("/Volumes")) {
        const testPath = `/Volumes/${volume}/work/scrapes`;
        if (existsSync(testPath)) return testPath;
      }
    } catch {
      // can't read /Volumes — fall through
    }

    return defaultPath;
  }

  if (platform === "win32") {
    const letters = "ZYXWVUTSRQPONM".split("");
    for (const l of letters) {
      const testPath = `${l}:\\work\\scrapes`;
      if (existsSync(testPath)) return testPath;
    }

    const uncPath = "\\\\UHEROroot\\work\\scrapes";
    if (existsSync(uncPath)) return uncPath;

    return "Z:\\work\\scrapes";
  }

  // Linux / other
  return "/Volumes/UHEROroot/work/scrapes";
}
