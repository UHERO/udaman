export function formatDollar(n: number): string {
  if (n < 0) return `-${formatDollar(-n)}`;
  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return `$${n.toLocaleString()}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function formatNumericValue(
  n: number,
  category: string,
): string {
  if (
    category === "large-dollar" ||
    category === "small-dollar"
  ) {
    return formatDollar(n);
  }
  if (category === "year") return String(Math.round(n));
  return formatNumber(n);
}
