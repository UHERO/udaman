/** Minimal RFC 4180 CSV helpers for extract files. */

export function csvField(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Split one CSV line (RFC 4180 quoting; no embedded newlines). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Number → text, rounded to 15 significant digits so spreadsheet float
 * noise (49940438.00000001) prints the way the source shows it, and the
 * same data always gives the same bytes.
 */
export function formatNumber(v: number): string {
  return String(Number(v.toPrecision(15)));
}
