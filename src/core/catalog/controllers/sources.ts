import { createLogger } from "@/core/observability/logger";
import type { Universe } from "../types/shared";
import SourceCollection from "../collections/source-collection";
import type { CreateSourcePayload, UpdateSourcePayload } from "../collections/source-collection";

const log = createLogger("catalog.sources");

/*************************************************************************
 * SOURCES Controller
 *************************************************************************/

export async function getSources({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching sources");
  const data = await SourceCollection.list({ universe: u });
  log.info({ count: data.length }, "sources fetched");
  return { data };
}

export async function getSource({ id }: { id: number }) {
  log.info({ id }, "fetching source");
  const data = await SourceCollection.getById(id);
  return { data };
}

export async function getOrCreateSource({
  description,
  link,
  universe,
}: {
  description: string;
  link?: string | null;
  universe?: Universe;
}) {
  log.info({ description, universe }, "get or create source");
  const data = await SourceCollection.getOrCreate(description, link ?? null, universe);
  log.info({ id: data.id, description }, "source resolved");
  return { data };
}

export async function createSource({ payload }: { payload: CreateSourcePayload }) {
  log.info({ payload }, "creating source");
  const data = await SourceCollection.create(payload);
  log.info({ id: data.id }, "source created");
  return { data };
}

export async function updateSource({ id, payload }: { id: number; payload: UpdateSourcePayload }) {
  log.info({ id, payload }, "updating source");
  const data = await SourceCollection.update(id, payload);
  log.info({ id }, "source updated");
  return { data };
}

export async function deleteSource({ id }: { id: number }) {
  log.info({ id }, "deleting source");
  await SourceCollection.delete(id);
  log.info({ id }, "source deleted");
}
