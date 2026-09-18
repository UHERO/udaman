import type { Universe } from "../types/shared";

export type UnitAttrs = {
  id: number;
  universe?: string;
  short_label?: string | null;
  long_label?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class Unit {
  readonly id: number;
  readonly universe: Universe;
  shortLabel: string | null;
  longLabel: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: UnitAttrs) {
    this.id = attrs.id;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.shortLabel = attrs.short_label ?? null;
    this.longLabel = attrs.long_label ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  toString(): string {
    return `${this.longLabel} (${this.shortLabel})`;
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      shortLabel: this.shortLabel,
      longLabel: this.longLabel,
    };
  }
}

export default Unit;
