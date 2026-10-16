export type UniverseAttrs = {
  name: string;
  description?: string | null;
  data_portal_url?: string | null;
  internal_only?: number | boolean | null;
};

class Universe {
  readonly name: string;
  readonly description: string | null;
  readonly dataPortalUrl: string | null;
  /** Data portal requires a login; hidden from the portal directory. */
  readonly internalOnly: boolean;

  constructor(attrs: UniverseAttrs) {
    this.name = attrs.name;
    this.description = attrs.description ?? null;
    this.dataPortalUrl = attrs.data_portal_url ?? null;
    this.internalOnly = Boolean(attrs.internal_only);
  }

  toString(): string {
    return this.name;
  }

  toJSON() {
    return {
      name: this.name,
      description: this.description,
      dataPortalUrl: this.dataPortalUrl,
      internalOnly: this.internalOnly,
    };
  }
}

export default Universe;
