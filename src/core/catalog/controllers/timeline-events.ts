import "server-only";

import { createLogger } from "@/core/observability/logger";

import TimelineEventCollection from "../collections/timeline-event-collection";
import type {
  CreateTimelineEventPayload,
  UpdateTimelineEventPayload,
} from "../collections/timeline-event-collection";

const log = createLogger("catalog.timeline-events");

export async function getTimelineEvents({
  eventTypes,
}: { eventTypes?: string[] } = {}) {
  log.info({ eventTypes }, "fetching timeline events");
  const data = await TimelineEventCollection.list(eventTypes);
  log.info({ count: data.length }, "timeline events fetched");
  return { data };
}

export async function getTimelineEvent({ id }: { id: number }) {
  log.info({ id }, "fetching timeline event");
  const data = await TimelineEventCollection.getById(id);
  return { data };
}

export async function createTimelineEvent({
  payload,
}: {
  payload: CreateTimelineEventPayload;
}) {
  log.info({ payload }, "creating timeline event");
  const data = await TimelineEventCollection.create(payload);
  log.info({ id: data.id }, "timeline event created");
  return { message: "Timeline event created", data };
}

export async function updateTimelineEvent({
  id,
  payload,
}: {
  id: number;
  payload: UpdateTimelineEventPayload;
}) {
  log.info({ id, payload }, "updating timeline event");
  const data = await TimelineEventCollection.update(id, payload);
  log.info({ id }, "timeline event updated");
  return { message: "Timeline event updated", data };
}

export async function deleteTimelineEvent({ id }: { id: number }) {
  log.info({ id }, "deleting timeline event");
  await TimelineEventCollection.delete(id);
  log.info({ id }, "timeline event deleted");
  return { message: "Timeline event deleted" };
}
