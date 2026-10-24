import type { LaggingLoader } from "@catalog/collections/loader-collection";

import { createLogger } from "@/core/observability/logger";

import { Mailer } from "./mailer";

/**
 * Slack digest of loaders past their lag limit (`data_sources.max_lag_days`),
 * sent after the nightly batch reload. One message per night while anything
 * is behind; nothing when every monitored loader is within its limit.
 */

const log = createLogger("mailer.loader-lag");

/** #automation everywhere for now; #udaman is for discussion and rarer events. */
const SLACK_LAG_CHANNEL = "automation";

/** Public base URL (no `/udaman` prefix — see pre-release-mailer.ts). */
const BASE_URL =
  process.env.UDAMAN_BASE_URL ??
  process.env.AUTH_URL ??
  "https://udaman.uhero.hawaii.edu";

export function formatLoaderLagMessage(lagging: LaggingLoader[]): string {
  const lines = [...lagging]
    .sort((a, b) => (b.lagDays ?? Infinity) - (a.lagDays ?? Infinity))
    .map((l) => {
      const url = `${BASE_URL}/${l.universe.toLowerCase()}/series/${l.seriesId}`;
      const status =
        l.lastDate === null
          ? "no data points"
          : `last ${l.lastDate}, ${l.lagDays}d behind`;
      return `• <${url}|${l.seriesName}> loader #${l.loaderId}: ${status} (limit ${l.maxLagDays}d)`;
    });
  const n = lagging.length;
  return [`*${n} loader${n === 1 ? "" : "s"} past lag limit*`, ...lines].join(
    "\n",
  );
}

export async function notifyLaggingLoaders(
  lagging: LaggingLoader[],
): Promise<void> {
  if (!lagging.length) return;
  log.info(
    { count: lagging.length, channel: SLACK_LAG_CHANNEL },
    "Sending loader lag Slack notification",
  );
  await Mailer.slack({
    channel: SLACK_LAG_CHANNEL,
    text: formatLoaderLagMessage(lagging),
  });
}
