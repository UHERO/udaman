/** Small pure text helpers shared by the DCCA parsers and matcher. */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/**
 * Decode entities the HTML parser leaves behind. The register HTML-encodes
 * names ("&#39;AINA", "&#34;AKAHAI&#34;") and node-html-parser only decodes
 * them in some code paths, so text values get an explicit pass.
 */
export function decodeEntities(raw: string): string {
  let s = raw;
  for (let pass = 0; pass < 3 && s.includes("&"); pass++) {
    const next = s.replace(
      /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z]+));/g,
      (whole, dec?: string, hex?: string, name?: string) => {
        if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
        const code = dec ? Number(dec) : parseInt(hex as string, 16);
        return code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : whole;
      },
    );
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Decode entities, collapse whitespace runs (incl. nbsp) to one space, trim. */
export function cleanText(raw: string | null | undefined): string {
  return decodeEntities(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "" → null, otherwise the cleaned text. */
export function textOrNull(raw: string | null | undefined): string | null {
  const s = cleanText(raw);
  return s === "" ? null : s;
}

/** Whole non-negative integer, else null ("", "N/A", "2 " → 2). */
export function intOrNull(raw: string | null | undefined): number | null {
  const s = cleanText(raw).replace(/,/g, "");
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/**
 * The register prints a 9-digit TMK: county digit, zone, section, plat (3),
 * parcel (3) — no dashes and no CPR suffix. The housing DB's tmk is
 * "C-Z-S-PPP-PPP-CCCC"; a project's parent parcel always has CPR 0000.
 * A 13-digit value (CPR included) is honored; anything else is null.
 */
export function expandTmk(raw: string | null | undefined): string | null {
  const d = cleanText(raw).replace(/\D/g, "");
  if (d.length !== 9 && d.length !== 13) return null;
  if (!/^[1-4]/.test(d)) return null;
  const cpr = d.length === 13 ? d.slice(9, 13) : "0000";
  return `${d[0]}-${d[1]}-${d[2]}-${d.slice(3, 6)}-${d.slice(6, 9)}-${cpr}`;
}

/** Island / county digit of a dashed TMK ("2-4-7-…" → "2"). */
export function tmkCounty(tmk: string): string {
  return tmk.charAt(0);
}
