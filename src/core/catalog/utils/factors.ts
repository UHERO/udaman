/**
 * Seasonal factor hash serialization for the `xseries.factors` column.
 *
 * Rails declares `serialize :factors, Hash` (tmp/models/xseries.rb:10), which
 * stores the hash as YAML, not JSON:
 *
 *   ---
 *   '1': 0.0009787083094200666
 *   '4': 0.0009986797322699683
 *
 * Keys are month numbers as strings ("1".."12" for monthly series; "1", "4",
 * "7", "10" for quarterly, since quarters are keyed by their first month).
 * Every live row in the column is in this format, so we read and write it
 * rather than switching to JSON — JSON rows would be unreadable to any
 * remaining Rails reader, and vice versa.
 */

/** One line of the Rails YAML hash: optionally-quoted key, then a number. */
const YAML_ENTRY = /^\s*'?([^':\s]+)'?\s*:\s*(.+?)\s*$/;

/**
 * Parse a serialized factors hash. Accepts the Rails YAML format and, as a
 * fallback, JSON. Returns null for empty/unparseable input.
 */
export function parseFactors(
  raw: string | null | undefined,
): Record<string, number> | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return coerceNumbers(parsed);
    } catch {
      return null;
    }
  }

  const out: Record<string, number> = {};
  for (const line of trimmed.split("\n")) {
    if (!line.trim() || line.trim() === "---") continue;
    const m = line.match(YAML_ENTRY);
    if (!m) continue;
    const value = Number(m[2]);
    if (Number.isNaN(value)) continue;
    out[m[1]] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function coerceNumbers(
  obj: Record<string, unknown>,
): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Serialize a factors hash back to the Rails YAML format. Keys are emitted in
 * numeric order and quoted (Ruby writes them as strings), and integral values
 * get an explicit `.0` so YAML reads them back as floats, matching Ruby.
 */
export function serializeFactors(factors: Record<string, number>): string {
  const keys = Object.keys(factors).sort((a, b) => Number(a) - Number(b));
  const lines = keys.map((k) => {
    const v = factors[k];
    const literal = Number.isInteger(v) ? `${v}.0` : String(v);
    return `'${k}': ${literal}`;
  });
  return `---\n${lines.join("\n")}\n`;
}
