export type ExportAttrs = {
  id: number;
  name?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  owned_by?: number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type SerializedExport = ReturnType<Export["toJSON"]>;

class Export {
  readonly id: number;
  name: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  ownedBy: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: ExportAttrs) {
    this.id = attrs.id;
    this.name = attrs.name ?? null;
    this.createdBy = attrs.created_by ?? null;
    this.updatedBy = attrs.updated_by ?? null;
    this.ownedBy = attrs.owned_by ?? null;
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  toString(): string {
    return `Export#${this.id} ${this.name}`;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      ownedBy: this.ownedBy,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export default Export;
