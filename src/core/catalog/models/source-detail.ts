import type { Universe } from "../types/shared";

export type SourceDetailAttrs = {
  id: number;
  universe?: string;
  description?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class SourceDetail {
  readonly id: number;
  readonly universe: Universe;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: SourceDetailAttrs) {
    this.id = attrs.id;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.description = attrs.description ?? null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at as string | Date) : null;
    this.updatedAt = attrs.updated_at ? new Date(attrs.updated_at as string | Date) : null;
  }

  toString(): string {
    return this.description ?? String(this.id);
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      description: this.description,
    };
  }
}

export default SourceDetail;
