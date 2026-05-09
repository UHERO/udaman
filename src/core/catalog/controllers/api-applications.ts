import "server-only";

import { createLogger } from "@/core/observability/logger";

import ApiApplicationCollection from "../collections/api-application-collection";
import type {
  CreateApiApplicationPayload,
  UpdateApiApplicationPayload,
} from "../collections/api-application-collection";
import type { Universe } from "../types/shared";

const log = createLogger("catalog.api-applications");

export async function getApiApplications({ u }: { u?: Universe } = {}) {
  log.info({ universe: u }, "fetching api applications");
  const data = await ApiApplicationCollection.list({ universe: u });
  log.info({ count: data.length }, "api applications fetched");
  return { data };
}

export async function getApiApplication({ id }: { id: number }) {
  log.info({ id }, "fetching api application");
  const data = await ApiApplicationCollection.getById(id);
  return { data };
}

export async function createApiApplication({
  payload,
}: {
  payload: CreateApiApplicationPayload;
}) {
  log.info({ payload }, "creating api application");
  const data = await ApiApplicationCollection.create(payload);
  log.info({ id: data.id }, "api application created");
  return { message: "API key created", data };
}

export async function updateApiApplication({
  id,
  payload,
}: {
  id: number;
  payload: UpdateApiApplicationPayload;
}) {
  log.info({ id, payload }, "updating api application");
  const data = await ApiApplicationCollection.update(id, payload);
  log.info({ id }, "api application updated");
  return { message: "API key updated", data };
}

export async function deleteApiApplication({ id }: { id: number }) {
  log.info({ id }, "deleting api application");
  await ApiApplicationCollection.delete(id);
  log.info({ id }, "api application deleted");
  return { message: "API key deleted" };
}
