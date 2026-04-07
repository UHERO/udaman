import "server-only";

import { createLogger } from "@/core/observability/logger";

import UniverseCollection from "../collections/universe-collection";
import type {
  CreateUniversePayload,
  UpdateUniversePayload,
} from "../collections/universe-collection";

const log = createLogger("catalog.universe");

/*************************************************************************
 * UNIVERSE Controller
 *************************************************************************/

export async function getUniverses() {
  log.info("fetching universes");
  const data = await UniverseCollection.list();
  log.info({ count: data.length }, "universes fetched");
  return { data };
}

export async function getUniverse({ name }: { name: string }) {
  log.info({ name }, "fetching universe");
  const data = await UniverseCollection.getByName(name);
  return { data };
}

export async function getUniverseStats({ name }: { name: string }) {
  log.info({ name }, "fetching universe stats");
  const data = await UniverseCollection.getStats(name);
  log.info({ name }, "universe stats fetched");
  return { data };
}

export async function createUniverse({
  payload,
}: {
  payload: CreateUniversePayload;
}) {
  log.info({ payload }, "creating universe");
  const data = await UniverseCollection.create(payload);
  log.info({ name: data.name }, "universe created");
  return { message: `Universe ${data.name} created`, data };
}

export async function updateUniverse({
  name,
  payload,
}: {
  name: string;
  payload: UpdateUniversePayload;
}) {
  log.info({ name, payload }, "updating universe");
  const data = await UniverseCollection.update(name, payload);
  log.info({ name }, "universe updated");
  return { message: `Universe ${name} updated`, data };
}

export async function renameUniverse({
  oldName,
  newName,
}: {
  oldName: string;
  newName: string;
}) {
  log.info({ oldName, newName }, "renaming universe");
  const data = await UniverseCollection.rename(oldName, newName);
  log.info({ oldName, newName }, "universe renamed");
  return { message: `Universe renamed to ${newName}`, data };
}

export async function deleteUniverse({ name }: { name: string }) {
  log.info({ name }, "deleting universe");
  await UniverseCollection.delete(name);
  log.info({ name }, "universe deleted");
  return { message: `Universe ${name} deleted` };
}
