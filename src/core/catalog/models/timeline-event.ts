export type TimelineEventAttrs = {
  id: number;
  event_type?: string;
  name?: string;
  description?: string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

function toISODate(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** Format a snake_case event type for display: "economic_crisis" → "Economic Crisis" */
export function formatEventType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

class TimelineEvent {
  readonly id: number;
  eventType: string;
  name: string;
  description: string | null;
  /** ISO date string (YYYY-MM-DD) */
  startDate: string;
  /** ISO date string or null for single-day events */
  endDate: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: TimelineEventAttrs) {
    this.id = attrs.id;
    this.eventType = attrs.event_type ?? "recession";
    this.name = attrs.name ?? "";
    this.description = attrs.description ?? null;
    this.startDate = toISODate(attrs.start_date) ?? "";
    this.endDate = toISODate(attrs.end_date);
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  /** For single-day events, returns startDate; otherwise endDate */
  get effectiveEndDate(): string {
    return this.endDate ?? this.startDate;
  }

  toString(): string {
    return this.name;
  }

  toJSON() {
    return {
      id: this.id,
      eventType: this.eventType,
      name: this.name,
      description: this.description,
      startDate: this.startDate,
      endDate: this.endDate,
      effectiveEndDate: this.effectiveEndDate,
    };
  }
}

export type SerializedTimelineEvent = ReturnType<TimelineEvent["toJSON"]>;

export default TimelineEvent;
