export type UniverseAttrs = {
  name: string;
  description?: string | null;
  data_portal_url?: string | null;
};

class Universe {
  readonly name: string;
  readonly description: string | null;
  readonly dataPortalUrl: string | null;

  constructor(attrs: UniverseAttrs) {
    this.name = attrs.name;
    this.description = attrs.description ?? null;
    this.dataPortalUrl = attrs.data_portal_url ?? null;
  }

  toString(): string {
    return this.name;
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      dataPortalUrl: this.dataPortalUrl,
    };
  }
}

export default Universe;
