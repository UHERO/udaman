"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateUniversePayload,
  UpdateUniversePayload,
} from "@catalog/collections/universe-collection";
import {
  createUniverse as createUniverseCtrl,
  deleteUniverse as deleteUniverseCtrl,
  getUniverses as fetchUniverses,
  getUniverseStats as fetchUniverseStats,
  renameUniverse as renameUniverseCtrl,
  updateUniverse as updateUniverseCtrl,
} from "@catalog/controllers/universe";
import {
  enqueueUniverseArchive,
  enqueueUniversePurge,
} from "@/core/workers/enqueue";

import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.universes");

export async function getUniverses() {
  await requirePermission("universe", "read");
  log.info("getUniverses action called");
  const result = await fetchUniverses();
  log.info({ count: result.data.length }, "getUniverses action completed");
  return result.data.map((u) => u.toJSON());
}

export async function getUniverseStats(name: string) {
  await requirePermission("universe", "read");
  log.info({ name }, "getUniverseStats action called");
  const result = await fetchUniverseStats({ name });
  return result.data;
}

export async function createUniverse(payload: CreateUniversePayload) {
  await requirePermission("universe", "create");
  log.info({ name: payload.name }, "createUniverse action called");
  const result = await createUniverseCtrl({ payload });
  revalidatePath("/catalog");
  log.info({ name: payload.name }, "createUniverse action completed");
  return { message: result.message, data: result.data.toJSON() };
}

export async function updateUniverse(
  name: string,
  payload: UpdateUniversePayload,
) {
  await requirePermission("universe", "update");
  log.info({ name }, "updateUniverse action called");
  const result = await updateUniverseCtrl({ name, payload });
  revalidatePath("/catalog");
  return { message: result.message, data: result.data.toJSON() };
}

export async function renameUniverse(oldName: string, newName: string) {
  await requirePermission("universe", "update");
  log.info({ oldName, newName }, "renameUniverse action called");
  const result = await renameUniverseCtrl({ oldName, newName });
  revalidatePath("/catalog");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteUniverse(name: string) {
  await requirePermission("universe", "delete");
  log.info({ name }, "deleteUniverse action called");
  const result = await deleteUniverseCtrl({ name });
  revalidatePath("/catalog");
  log.info({ name }, "deleteUniverse action completed");
  return { message: result.message };
}

/** Universes that cannot be archived or purged. */
const PROTECTED_UNIVERSES = new Set(["UHERO"]);

export async function archiveUniverseAction(
  name: string,
  scheduledAt: string,
) {
  await requirePermission("universe", "delete");

  if (PROTECTED_UNIVERSES.has(name.toUpperCase())) {
    return { success: false, message: `Universe ${name} is protected and cannot be archived via this action` };
  }

  const runAt = new Date(scheduledAt);
  if (isNaN(runAt.getTime())) {
    return { success: false, message: "Invalid scheduled time" };
  }

  log.info({ name, scheduledAt }, "archiveUniverse action enqueued");
  try {
    const job = await enqueueUniverseArchive({ universe: name }, runAt);
    return {
      success: true,
      message: `Archive for ${name} scheduled at ${runAt.toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })} HST. Job ID: ${job.id}`,
    };
  } catch (error) {
    log.error({ name, error }, "archiveUniverse enqueue failed");
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to schedule archive",
    };
  }
}

export async function purgeUniverseAction(
  name: string,
  scheduledAt: string,
) {
  await requirePermission("universe", "delete");

  if (PROTECTED_UNIVERSES.has(name.toUpperCase())) {
    return { success: false, message: `Universe ${name} is protected and cannot be deleted` };
  }

  const runAt = new Date(scheduledAt);
  if (isNaN(runAt.getTime())) {
    return { success: false, message: "Invalid scheduled time" };
  }

  log.info({ name, scheduledAt }, "purgeUniverse action enqueued");
  try {
    const job = await enqueueUniversePurge({ universe: name }, runAt);
    return {
      success: true,
      message:
        `Delete for ${name} scheduled at ${runAt.toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })} HST. Job ID: ${job.id}. ` +
        `The job will verify a recent archive exists before proceeding.`,
    };
  } catch (error) {
    log.error({ name, error }, "purgeUniverse enqueue failed");
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to schedule delete",
    };
  }
}

export async function canDeleteUniverse(): Promise<boolean> {
  try {
    await requirePermission("universe", "delete");
    return true;
  } catch {
    return false;
  }
}
