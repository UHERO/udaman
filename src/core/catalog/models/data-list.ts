import type { Universe } from "../types/shared";

export type DataListAttrs = {
  id: number;
  universe?: string;
  name?: string | null;
  startyear?: number | null;
  endyear?: number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
  created_by?: number | null;
  updated_by?: number | null;
  owned_by?: number | null;
};

class DataList {
  readonly id: number;
  readonly universe: Universe;
  name: string | null;
  startYear: number | null;
  endYear: number | null;
  createdBy: number | null;
  updatedBy: number | null;
  ownedBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: DataListAttrs) {
    this.id = attrs.id;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.name = attrs.name ?? null;
    this.startYear = attrs.startyear ?? null;
    this.endYear = attrs.endyear ?? null;
    this.createdBy = attrs.created_by ?? null;
    this.updatedBy = attrs.updated_by ?? null;
    this.ownedBy = attrs.owned_by ?? null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at as string | Date) : null;
    this.updatedAt = attrs.updated_at ? new Date(attrs.updated_at as string | Date) : null;
  }

  toString(): string {
    return this.name ?? `DataList(${this.id})`;
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      name: this.name,
      startYear: this.startYear,
      endYear: this.endYear,
    };
  }
}

export default DataList;
