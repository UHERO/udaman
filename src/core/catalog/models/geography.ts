import type { Universe } from "../types/shared";

export type GeographyAttrs = {
  id: number;
  universe: string;
  handle?: string | null;
  display_name?: string | null;
  display_name_short?: string | null;
  fips?: string | null;
  list_order?: number | null;
  geotype?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class Geography {
  readonly id: number;
  readonly universe: Universe;
  handle: string | null;
  displayName: string | null;
  displayNameShort: string | null;
  fips: string | null;
  listOrder: number | null;
  geotype: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: GeographyAttrs) {
    this.id = attrs.id;
    this.universe = attrs.universe as Universe;
    this.handle = attrs.handle ?? null;
    this.displayName = attrs.display_name ?? null;
    this.displayNameShort = attrs.display_name_short ?? null;
    this.fips = attrs.fips ?? null;
    this.listOrder = attrs.list_order ?? null;
    this.geotype = attrs.geotype ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  toString(): string {
    return this.handle ?? String(this.id);
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      handle: this.handle,
      displayName: this.displayName,
      displayNameShort: this.displayNameShort,
      fips: this.fips,
      listOrder: this.listOrder,
      geotype: this.geotype,
    };
  }
}

export default Geography;
