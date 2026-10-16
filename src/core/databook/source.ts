/**
 * The Data Book as the `databook` extractor sees it: its downloader's
 * stored workbooks (newest vintage per key), parsed and matched to the
 * base edition. The universe tooling (sync, history) reads the same files
 * the extract is built from, so its series line up with the extract's.
 */
import DataExtractorCollection from "@catalog/collections/data-extractor-collection";

import { getSource } from "@/core/ingest/registry";
import { defaultEnv, resolveInputs } from "@/core/ingest/run";
import type { ManifestSection } from "@/core/ingest/sources/databook/manifest";
import {
  DEFAULT_BASE_EDITION,
  matchDatabook,
  type MatchedDatabook,
} from "@/core/ingest/sources/databook/parse";

export const DATABOOK_EXTRACTOR = "databook";

export async function storedDatabook(
  opts: { previous?: ManifestSection[]; log?: (msg: string) => void } = {},
): Promise<MatchedDatabook> {
  const extractor =
    await DataExtractorCollection.getByHandle(DATABOOK_EXTRACTOR);
  const source = getSource(extractor.sourceKey);
  const { inputs } = await resolveInputs(
    extractor,
    source,
    source.dimensions(extractor),
    defaultEnv(),
  );
  if (inputs.length === 0)
    throw new Error(
      `${DATABOOK_EXTRACTOR} has no stored workbooks (bun run ingest fetch ${DATABOOK_EXTRACTOR})`,
    );
  return matchDatabook(inputs, {
    baseEdition: Number(extractor.config.baseEdition ?? DEFAULT_BASE_EDITION),
    previous: opts.previous,
    log: opts.log,
  });
}
