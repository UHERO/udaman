/**
 * Slack link previews for udaman series pages. Series pages sit behind login,
 * so Slack's own crawler only ever sees the login page; instead the Slack app
 * receives `link_shared` events (see /api/webhooks/slack) and answers with
 * chat.unfurl. Previews are visible to anyone in the workspace — by design,
 * series names and latest values are fine to share within the org.
 */
import SeriesCollection from "@catalog/collections/series-collection";
import { freqDate } from "@catalog/utils/time";

import { sendSlackUnfurl } from "@/core/mailers/slack";
import { createLogger } from "@/core/observability/logger";
import { formatChange, formatLatestValue } from "@/lib/series-preview";

const log = createLogger("slack.unfurl");

/** Most links Slack sends per event is small; cap lookups anyway. */
const MAX_LINKS = 5;

export interface LinkSharedEvent {
  type: "link_shared";
  channel?: string;
  message_ts?: string;
  unfurl_id?: string;
  source?: string;
  links: { domain: string; url: string }[];
}

type SeriesPreview = NonNullable<
  Awaited<ReturnType<typeof SeriesCollection.getLinkPreview>>
>;

/**
 * Series id from a udaman URL, or null. Matches the subdomain form
 * (`/uhero/series/123`) and direct access (`/udaman/uhero/series/123`),
 * including sub-pages like `/series/123/data-points/…`.
 */
export function parseSeriesLink(url: string): number | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const m = pathname.match(/^(?:\/udaman)?\/[^/]+\/series\/(\d+)(?:\/|$)/);
  return m ? Number(m[1]) : null;
}

/** Slack mrkdwn needs &, < and > escaped; everything else passes through. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildSeriesUnfurlBlocks(p: SeriesPreview): unknown[] {
  const heading = p.title ? `*${esc(p.title)}*\n` : "";
  const details = [
    `\`${esc(p.name)}\``,
    p.geography && esc(p.geography),
    p.frequency && capitalize(p.frequency),
  ]
    .filter(Boolean)
    .join(" · ");

  const [latest, prev] = p.latest;
  let latestLine = "_No data yet_";
  if (latest) {
    const obs = {
      value: latest.value,
      prevValue: prev?.value,
      decimals: p.decimals,
      percent: p.percent,
      unitsLabel: p.unitsLabel,
    };
    const change = formatChange(obs);
    latestLine =
      `*Latest:* ${esc(formatLatestValue(obs))} — ${freqDate(latest.date, p.frequency)}` +
      (change && prev
        ? `   ${change} vs ${freqDate(prev.date, p.frequency)}`
        : "");
  }

  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `${heading}${details}\n${latestLine}` },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `UDAMAN · ${esc(p.universe)}` }],
    },
  ];
}

/** Look up each series link in the event and attach previews to the message. */
export async function unfurlSeriesLinks(event: LinkSharedEvent): Promise<void> {
  const unfurls: Record<string, { blocks: unknown[] }> = {};

  for (const { url } of event.links.slice(0, MAX_LINKS)) {
    const id = parseSeriesLink(url);
    if (id === null || unfurls[url]) continue;
    const preview = await SeriesCollection.getLinkPreview(id);
    if (!preview) continue;
    unfurls[url] = { blocks: buildSeriesUnfurlBlocks(preview) };
  }

  if (Object.keys(unfurls).length === 0) return;

  await sendSlackUnfurl({
    channel: event.channel,
    ts: event.message_ts,
    unfurlId: event.unfurl_id,
    source: event.source,
    unfurls,
  });
  log.info({ count: Object.keys(unfurls).length }, "series links unfurled");
}
