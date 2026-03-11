export interface HhdbOwnerAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  owner_name?: string | null;
  owner_type?: string | null;
  owner_address?: string | null;
  sequence_order?: number | null;
  created_at?: Date | string | null;
}

export class HhdbOwner {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  ownerName: string | null;
  ownerType: string | null;
  ownerAddress: string | null;
  sequenceOrder: number | null;
  createdAt: Date | null;

  constructor(attrs: HhdbOwnerAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.ownerName = attrs.owner_name ?? null;
    this.ownerType = attrs.owner_type ?? null;
    this.ownerAddress = attrs.owner_address ?? null;
    this.sequenceOrder =
      attrs.sequence_order != null ? Number(attrs.sequence_order) : null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      ownerName: this.ownerName,
      ownerType: this.ownerType,
      ownerAddress: this.ownerAddress,
      sequenceOrder: this.sequenceOrder,
      createdAt: this.createdAt?.toISOString() ?? null,
    };
  }
}

export type HhdbOwnerJSON = ReturnType<HhdbOwner["toJSON"]>;

export function hhdbOwnerRowToJSON(attrs: HhdbOwnerAttrs): HhdbOwnerJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    scrapedAt: attrs.scraped_at
      ? new Date(attrs.scraped_at).toISOString()
      : null,
    ownerName: attrs.owner_name ?? null,
    ownerType: attrs.owner_type ?? null,
    ownerAddress: attrs.owner_address ?? null,
    sequenceOrder:
      attrs.sequence_order != null ? Number(attrs.sequence_order) : null,
    createdAt: attrs.created_at
      ? new Date(attrs.created_at).toISOString()
      : null,
  };
}
