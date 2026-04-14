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
  await requirePermission("timeline_event", "create");
  log.info("createTimelineEvent action called");
  const result = await createCtrl({ payload });
  revalidatePath("/udaman", "layout");
  return { message: result.message, data: result.data.toJSON() };
}

export async function updateTimelineEventAction(
  id: number,
  payload: UpdateTimelineEventPayload,
) {
  await requirePermission("timeline_event", "update");
  log.info({ id }, "updateTimelineEvent action called");
  const result = await updateCtrl({ id, payload });
  revalidatePath("/udaman", "layout");
  return { message: result.message, data: result.data.toJSON() };
}

export async function deleteTimelineEventAction(id: number) {
  await requirePermission("timeline_event", "delete");
  log.info({ id }, "deleteTimelineEvent action called");
  const result = await deleteCtrl({ id });
  revalidatePath("/udaman", "layout");
  return { message: result.message };
}
