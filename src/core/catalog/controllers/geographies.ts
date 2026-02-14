import { createLogger } from "@/core/observability/logger";

import GeographyCollection from "../collections/geography-collection";
import type {
  CreateGeographyPayload,
  UpdateGeographyPayload,
} from "../collections/geography-collection";
import type { Universe } from "../types/shared";

const log = createLogger("catalog.geographies");

/*************************************************************************
 * GEOGRAPHIES Controller
 *************************************************************************/

export async function getGeographies({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching geographies");
  const data = await GeographyCollection.list({ universe: u });
  log.info({ count: data.length }, "geographies fetched");
  return { data };
}

export async function getGeography({ id }: { id: number }) {
  log.info({ id }, "fetching geography");
  const data = await GeographyCollection.getById(id);
  return { data };
}

export async function createGeography({
  payload,
}: {
  payload: CreateGeographyPayload;
}) {
  log.info({ payload }, "creating geography");
  const data = await GeographyCollection.create(payload);
  log.info({ id: data.id }, "geography created");
  return { message: "Geography created", data };
}

export async function updateGeography({
  id,
  payload,
}: {
  id: number;
  payload: UpdateGeographyPayload;
}) {
  log.info({ id, payload }, "updating geography");
  const data = await GeographyCollection.update(id, payload);
  log.info({ id }, "geography updated");
  return { message: "Geography updated", data };
}

export async function deleteGeography({ id }: { id: number }) {
  log.info({ id }, "deleting geography");
  await GeographyCollection.delete(id);
  log.info({ id }, "geography deleted");
  return { message: "Geography deleted" };
}
