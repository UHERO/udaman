import { createLogger } from "@/core/observability/logger";
import type { Universe } from "../types/shared";
import SourceDetailCollection from "../collections/source-detail-collection";
import type { CreateSourceDetailPayload, UpdateSourceDetailPayload } from "../collections/source-detail-collection";

const log = createLogger("catalog.source-details");

/*************************************************************************
 * SOURCE DETAILS Controller
 *************************************************************************/

export async function getSourceDetails({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching source details");
  const data = await SourceDetailCollection.list({ universe: u });
  log.info({ count: data.length }, "source details fetched");
  return { data };
}

export async function getSourceDetail({ id }: { id: number }) {
  log.info({ id }, "fetching source detail");
  const data = await SourceDetailCollection.getById(id);
  return { data };
}

export async function createSourceDetail({ payload }: { payload: CreateSourceDetailPayload }) {
  log.info({ payload }, "creating source detail");
  const data = await SourceDetailCollection.create(payload);
  log.info({ id: data.id }, "source detail created");
  return { data };
}

export async function updateSourceDetail({ id, payload }: { id: number; payload: UpdateSourceDetailPayload }) {
  log.info({ id, payload }, "updating source detail");
  const data = await SourceDetailCollection.update(id, payload);
  log.info({ id }, "source detail updated");
  return { data };
}

export async function deleteSourceDetail({ id }: { id: number }) {
  log.info({ id }, "deleting source detail");
  await SourceDetailCollection.delete(id);
  log.info({ id }, "source detail deleted");
}
