import { mysql } from "@/lib/mysql/db";
import { buildUpdateObject } from "@/lib/mysql/helpers";

import TimelineEvent from "../models/timeline-event";
import type { TimelineEventAttrs } from "../models/timeline-event";

export type CreateTimelineEventPayload = {
  eventType: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
};

export type UpdateTimelineEventPayload = Partial<CreateTimelineEventPayload>;

class TimelineEventCollection {
  /** Fetch all events, optionally filtered by event types */
  static async list(eventTypes?: string[]): Promise<TimelineEvent[]> {
    if (eventTypes && eventTypes.length > 0) {
      const rows = await mysql<TimelineEventAttrs>`
        SELECT * FROM timeline_events
        WHERE event_type IN (${eventTypes})
        ORDER BY start_date ASC, name ASC
      `;
      return rows.map((row) => new TimelineEvent(row));
    }
    const rows = await mysql<TimelineEventAttrs>`
      SELECT * FROM timeline_events ORDER BY start_date ASC, name ASC
    `;
    return rows.map((row) => new TimelineEvent(row));
  }

  /** Get distinct event types from the database */
  static async getDistinctTypes(): Promise<string[]> {
    const rows = await mysql<{ event_type: string }>`
      SELECT DISTINCT event_type FROM timeline_events ORDER BY event_type ASC
    `;
    return rows.map((r) => r.event_type);
  }

  /** Fetch a single event by ID */
  static async getById(id: number): Promise<TimelineEvent> {
    const rows = await mysql<TimelineEventAttrs>`
      SELECT * FROM timeline_events WHERE id = ${id} LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new Error(`Timeline event not found: ${id}`);
    return new TimelineEvent(row);
  }

  /** Create a new event */
  static async create(
    payload: CreateTimelineEventPayload,
  ): Promise<TimelineEvent> {
    const { eventType, name, description, startDate, endDate } = payload;
    await mysql`
      INSERT INTO timeline_events (event_type, name, description, start_date, end_date, created_at, updated_at)
      VALUES (${eventType}, ${name}, ${description ?? null}, ${startDate}, ${endDate ?? null}, NOW(), NOW())
    `;
    const [{ insertId }] = await mysql<{
      insertId: number;
    }>`SELECT LAST_INSERT_ID() as insertId`;
    return this.getById(insertId);
  }

  /** Update an event */
  static async update(
    id: number,
    updates: UpdateTimelineEventPayload,
  ): Promise<TimelineEvent> {
    if (!Object.keys(updates).length) return this.getById(id);

    const updateObj = buildUpdateObject(updates);
    const cols = Object.keys(updateObj);
    if (!cols.length) return this.getById(id);

    await mysql`
      UPDATE timeline_events
      SET ${mysql(updateObj, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return this.getById(id);
  }

  /** Delete an event */
  static async delete(id: number): Promise<void> {
    await mysql`DELETE FROM timeline_events WHERE id = ${id}`;
  }
}

export default TimelineEventCollection;
