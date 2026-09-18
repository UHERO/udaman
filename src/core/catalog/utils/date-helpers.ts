/**
 * Return the first month of a given quarter (1-indexed).
 * Q1→1, Q2→4, Q3→7, Q4→10
 */
export function firstMonthOfQuarter(q: number | string): number {
  const quarter = typeof q === "string" ? parseInt(q, 10) : q;
  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter: ${quarter}`);
  }
  return (quarter - 1) * 3 + 1;
}

/**
 * Build a date string "YYYY-MM-01" from a year and an optional quarter/month
 * specifier (e.g. "M3", "Q2", or null/blank for annual → January).
 */
export function makeDate(
  year: number | string,
  qm: string | null | undefined,
): string {
  const y = typeof year === "string" ? parseInt(year, 10) : year;
  if (isNaN(y)) {
    throw new Error(`Bad date params: year is invalid (${year})`);
  }

  let month = 1;
  if (qm) {
    const match = qm.match(/([MQ])(\d+)/i);
    if (match) {
      const type = match[1].toUpperCase();
      const num = parseInt(match[2], 10);
      if (type === "M") {
        month = num;
      } else if (type === "Q") {
        month = firstMonthOfQuarter(num);
      }
    }
  }

  if (month < 1 || month > 12) {
    throw new Error(`Bad date params: year=${y}, QM='${qm}'`);
  }

  return `${y}-${String(month).padStart(2, "0")}-01`;
}
