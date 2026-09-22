import type { Universe } from "../types/shared";

export type SourceAttrs = {
  id: number;
  universe?: string;
  description?: string | null;
  link?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class Source {
  readonly id: number;
  readonly universe: Universe;
  description: string | null;
  link: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: SourceAttrs) {
    this.id = attrs.id;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.description = attrs.description ?? null;
    this.link = attrs.link ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  get isValidLink(): boolean {
    if (!this.link) return true;
    try {
      new URL(this.link);
      return true;
    } catch {
      return false;
    }
  }

  toString(): string {
    return this.description ?? String(this.id);
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      description: this.description,
      link: this.link,
    };
  }
}

export default Source;
