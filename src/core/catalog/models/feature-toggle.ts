export type FeatureToggleAttrs = {
  id: number;
  universe?: string | null;
  name?: string | null;
  description?: string | null;
  status?: boolean | number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type SerializedFeatureToggle = ReturnType<FeatureToggle["toJSON"]>;

class FeatureToggle {
  readonly id: number;
  universe: string;
  name: string;
  description: string | null;
  status: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: FeatureToggleAttrs) {
    this.id = attrs.id;
    this.universe = attrs.universe ?? "UHERO";
    this.name = attrs.name ?? "";
    this.description = attrs.description ?? null;
    this.status = Boolean(attrs.status);
    this.createdAt = attrs.created_at
      ? new Date(attrs.created_at as string | Date)
      : null;
    this.updatedAt = attrs.updated_at
      ? new Date(attrs.updated_at as string | Date)
      : null;
  }

  toString(): string {
    return `FeatureToggle#${this.id} ${this.name}=${this.status}`;
  }

  toJSON() {
    return {
      id: this.id,
      universe: this.universe,
      name: this.name,
      description: this.description,
      status: this.status,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export default FeatureToggle;
