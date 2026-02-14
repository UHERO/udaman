import "server-only";
import { createLogger } from "@/core/observability/logger";

import UniverseCollection from "../collections/universe-collection";

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

export async function createUniverse({ name }: { name: string }) {
  log.info({ name }, "creating universe");
  const data = await UniverseCollection.create(name);
  log.info({ name }, "universe created");
  return { data };
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
  return { data };
}

export async function deleteUniverse({ name }: { name: string }) {
  log.info({ name }, "deleting universe");
  await UniverseCollection.delete(name);
  log.info({ name }, "universe deleted");
}
