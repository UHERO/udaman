/**
 * Internal display precision: show one extra decimal place so editors can
 * see more detail than the public-facing dashboards.  Zero stays zero
 * (integers should stay integers).
 */
export function internalDecimals(decimals: number): number {
  return decimals === 0 ? 0 : decimals + 1;
}

/**
 * Format a numeric value for display based on the series' unit short label.
 *
 * Currency units (any short_label containing "$") get:
 *   - "$" prefix
 *   - Thousands separators (commas)
 *   - No decimal places if |value| >= 1000 (no cents for large values)
 *   - `decimals` decimal places otherwise
 *
 * Percentage units ("%" short_label) get the "%" suffix.
 *
 * All other units use `toFixed(decimals)` with commas for readability.
 */
export function formatLevel(
  value: number,
  decimals: number,
  unitShortLabel?: string | null,
): string {
  const dp = internalDecimals(decimals);

  if (unitShortLabel && unitShortLabel.includes("$")) {
    return formatCurrency(value, dp);
  }

  if (unitShortLabel === "%" || unitShortLabel === "Percent") {
    return `${value.toFixed(dp)}%`;
  }

  return addCommas(value.toFixed(dp));
}

function formatCurrency(value: number, decimals: number): string {
  const abs = Math.abs(value);
  const dp = abs >= 1000 ? 0 : decimals;
  const formatted = addCommas(abs.toFixed(dp));
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

function addCommas(s: string): string {
  const [int, dec] = s.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
}
