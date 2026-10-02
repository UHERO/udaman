/**
 * Frequency switch helper (date-slider.updateEndDateAfterFreqChange, done at
 * the moment of the switch instead of on the next render).
 *
 * When the user changes frequency, rewrite the URL `end` to the LAST DAY of
 * the period it named under the old frequency. resolveDateRange then snaps it
 * to the last period <= that day at the new frequency, so an annual end of
 * 2020 becomes 2020 Q4 / 2020-12 (not 2020 Q1), 2020 Q2 → 2020-06, etc.
 *
 * This removes the need to remember `previousFreq` across a server
 * re-render (which may remount the page). usePreviousFreq + resolveDateRange
 * remain available for pages that keep the old approach.
 */
import { pad2 } from "../../lib/dates";
import type { FreqCode } from "../../lib/types";

const MONTHS_IN_PERIOD: Partial<Record<FreqCode, number>> = {
  A: 12,
  S: 6,
  Q: 3,
  M: 1,
};

export function endForFreqSwitch(
  end: string | null | undefined,
  previousFreq: FreqCode | null | undefined,
): string | null {
  if (!end) return null;
  const span = previousFreq ? MONTHS_IN_PERIOD[previousFreq] : undefined;
  if (!span) return end.substring(0, 10); // W / D / unknown: keep the date
  const year = +end.substring(0, 4);
  const month = previousFreq === "A" ? 1 : +end.substring(5, 7) || 1;
  const lastMonth = month + span - 1; // 1-based, ≤ 12 for aligned periods
  const y = year + Math.floor((lastMonth - 1) / 12);
  const m = ((lastMonth - 1) % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${pad2(m)}-${pad2(lastDay)}`;
}
