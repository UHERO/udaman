import "server-only";
import { createLogger } from "@/core/observability/logger";

import UnitCollection from "../collections/unit-collection";
import type {
  CreateUnitPayload,
  UpdateUnitPayload,
} from "../collections/unit-collection";
import type { Universe } from "../types/shared";

const log = createLogger("catalog.units");

/*************************************************************************
 * UNITS Controller
 *************************************************************************/

export async function getUnits({ u }: { u?: Universe }) {
  log.info({ universe: u }, "fetching units");
  const data = await UnitCollection.list({ universe: u });
  log.info({ count: data.length }, "units fetched");
  return { data };
}

export async function getUnit({ id }: { id: number }) {
  log.info({ id }, "fetching unit");
  const data = await UnitCollection.getById(id);
  return { data };
}

export async function getOrCreateUnit({
  label,
  universe,
}: {
  label: string;
  universe?: Universe;
}) {
  log.info({ label, universe }, "get or create unit");
  const data = await UnitCollection.getOrCreate(label, universe);
  log.info({ id: data.id, label }, "unit resolved");
  return { data };
}

export async function createUnit({ payload }: { payload: CreateUnitPayload }) {
  log.info({ payload }, "creating unit");
  const data = await UnitCollection.create(payload);
  log.info({ id: data.id }, "unit created");
  return { message: "Unit created", data };
}

export async function updateUnit({
  id,
  payload,
}: {
  id: number;
  payload: UpdateUnitPayload;
}) {
  log.info({ id, payload }, "updating unit");
  const data = await UnitCollection.update(id, payload);
  log.info({ id }, "unit updated");
  return { message: "Unit updated", data };
}

export async function deleteUnit({ id }: { id: number }) {
  log.info({ id }, "deleting unit");
  await UnitCollection.delete(id);
  log.info({ id }, "unit deleted");
  return { message: "Unit deleted" };
}
