/**
 * Pure URL builders for ShareLink (Angular share-link.component.ts).
 * Kept separate from the component so pages can build the same links
 * server-side if needed.
 */
import type { HrefParams } from "../../lib/links";
import { analyzerParamsToQuery } from "../../lib/url-params";
import type { AnalyzerParams } from "../../lib/url-params";

export type ShareTarget =
  | {
      view: "series";
      seriesId: number;
      /** Emitted as sa=true|false (Angular dropped sa=false, which the series page reads as SA). */
      seasonallyAdjusted?: boolean;
      /** Route start/end — pass null when showing the default range / end of sample. */
      start?: string | null;
      end?: string | null;
    }
  | {
      view: "analyzer";
      /** Current analyzer state (ids, chartSeries, axes, index, compare, transformations…). */
      analyzerParams: Partial<AnalyzerParams>;
      start?: string | null;
      end?: string | null;
    };

/** Params for the share link (/series or /analyzer). */
export function shareParams(t: ShareTarget): HrefParams {
  if (t.view === "series") {
    return {
      id: t.seriesId,
      sa: t.seasonallyAdjusted,
      start: t.start,
      end: t.end,
    };
  }
  return analyzerParamsToQuery({
    ...t.analyzerParams,
    start: t.start ?? t.analyzerParams.start ?? null,
    end: t.end ?? t.analyzerParams.end ?? null,
  });
}

/**
 * Params for the /graph embed. Series: only id/start/end (Angular
 * addSingleSeriesParams). Analyzer: the same params as the share link.
 */
export function embedParams(t: ShareTarget): HrefParams {
  if (t.view === "series") {
    return { id: t.seriesId, start: t.start, end: t.end };
  }
  return shareParams(t);
}

/** Responsive 16:9 iframe snippet — identical markup to Angular's. */
export function embedSnippet(graphUrl: string): string {
  return `<div style="position:relative;width:100%;overflow:hidden;padding-top:56.25%;height:475px;"><iframe style="position:absolute;top:0;left:0;bottom:0;right:0;width:100%;height:100%;border:none;" src="${graphUrl.replace(/"/g, "&quot;")}" scrolling="no"></iframe></div>`;
}
