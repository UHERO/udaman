import type { Frequency, Universe } from "../types/shared";

export type CategoryAttrs = {
  id: number;
  data_list_id?: number | null;
  default_geo_id?: number | null;
  universe?: string;
  name?: string | null;
  description?: string | null;
  ancestry?: string | null;
  list_order?: number | null;
  hidden?: boolean | number | null;
  masked?: boolean | number | null;
  header?: boolean | number | null;
  default_handle?: string | null;
  default_freq?: string | null;
  meta?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

class Category {
  readonly id: number;
  readonly universe: Universe;
  dataListId: number | null;
  defaultGeoId: number | null;
  name: string | null;
  description: string | null;
  ancestry: string | null;
  listOrder: number | null;
  hidden: boolean;
  masked: boolean;
  header: boolean;
  defaultHandle: string | null;
  defaultFreq: Frequency | null;
  meta: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: CategoryAttrs) {
    this.id = attrs.id;
    this.universe = (attrs.universe as Universe) ?? "UHERO";
    this.dataListId = attrs.data_list_id ?? null;
    this.defaultGeoId = attrs.default_geo_id ?? null;
    this.name = attrs.name ?? null;
    this.description = attrs.description ?? null;
    this.ancestry = attrs.ancestry ?? null;
    this.listOrder = attrs.list_order ?? null;
    this.hidden = Boolean(attrs.hidden);
    this.masked = Boolean(attrs.masked);
    this.header = Boolean(attrs.header);
    this.defaultHandle = attrs.default_handle ?? null;
    this.defaultFreq = (attrs.default_freq as Frequency) ?? null;
    this.meta = attrs.meta ?? null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at as string | Date) : null;
    this.updatedAt = attrs.updated_at ? new Date(attrs.updated_at as string | Date) : null;
  }

  /** The ancestry path including this node, e.g. "1/4/6" */
  get path(): string {
    return this.ancestry ? `${this.ancestry}/${this.id}` : `${this.id}`;
  }

  get depth(): number {
    return this.ancestry ? this.ancestry.split("/").length : 0;
  }

  toString(): string {
    return this.name ?? `Category(${this.id})`;
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      dataListId: this.dataListId,
      defaultGeoId: this.defaultGeoId,
      name: this.name,
      description: this.description,
      ancestry: this.ancestry,
      listOrder: this.listOrder,
      hidden: this.hidden,
      masked: this.masked,
      header: this.header,
      defaultHandle: this.defaultHandle,
      defaultFreq: this.defaultFreq,
      meta: this.meta,
    };
  }
}

export default Category;
