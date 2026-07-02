"use server";

import { revalidatePath } from "next/cache";
import type {
  CreateTimelineEventPayload,
  UpdateTimelineEventPayload,
} from "@catalog/collections/timeline-event-collection";
import {
  createTimelineEvent as createCtrl,
  deleteTimelineEvent as deleteCtrl,
  getTimelineEvents as fetchEvents,
  updateTimelineEvent as updateCtrl,
} from "@catalog/controllers/timeline-events";

import { AppLogCollection } from "@catalog/collections/app-log-collection";
import { createLogger } from "@/core/observability/logger";
import { requirePermission } from "@/lib/auth/permissions";

const log = createLogger("action.timeline-events");

export async function listTimelineEventsAction() {
  await requirePermission("timeline_event", "read");
  log.info("listTimelineEvents action called");
  const result = await fetchEvents();
  return result.data.map((e) => e.toJSON());
}

export async function createTimelineEventAction(
  payload: CreateTimelineEventPayload,
) {
  const { userId } = await requirePermission("timeline_event", "create");
  log.info("createTimelineEvent action called");
  try {
    const result = await createCtrl({ payload });
    revalidatePath("/udaman", "layout");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "createTimelineEvent failed");
    AppLogCollection.logError(err, { userId, name: "timeline-event.create" });
    throw err;
  }
}

export async function updateTimelineEventAction(
  id: number,
  payload: UpdateTimelineEventPayload,
) {
  const { userId } = await requirePermission("timeline_event", "update");
  log.info({ id }, "updateTimelineEvent action called");
  try {
    const result = await updateCtrl({ id, payload });
    revalidatePath("/udaman", "layout");
    return { message: result.message, data: result.data.toJSON() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "updateTimelineEvent failed");
    AppLogCollection.logError(err, { userId, name: "timeline-event.update" });
    throw err;
  }
}

export async function deleteTimelineEventAction(id: number) {
  const { userId } = await requirePermission("timeline_event", "delete");
  log.info({ id }, "deleteTimelineEvent action called");
  try {
    const result = await deleteCtrl({ id });
    revalidatePath("/udaman", "layout");
    return { message: result.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, userId }, "deleteTimelineEvent failed");
    AppLogCollection.logError(err, { userId, name: "timeline-event.delete" });
    throw err;
  }
}
