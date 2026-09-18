export interface HhdbOwnerAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  last_year_observed?: number | null;
  owner_name?: string | null;
  owner_type?: string | null;
  owner_address?: string | null;
  mailing_address?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_zip?: string | null;
  mailing_country?: string | null;
  sequence_order?: number | null;
  created_at?: Date | string | null;
}

export class HhdbOwner {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  lastYearObserved: number | null;
  ownerName: string | null;
  ownerType: string | null;
  ownerAddress: string | null;
  mailingAddress: string | null;
  mailingCity: string | null;
  mailingState: string | null;
  mailingZip: string | null;
  mailingCountry: string | null;
  sequenceOrder: number | null;
  createdAt: Date | null;

  constructor(attrs: HhdbOwnerAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.lastYearObserved =
      attrs.last_year_observed != null ? Number(attrs.last_year_observed) : null;
    this.ownerName = attrs.owner_name ?? null;
    this.ownerType = attrs.owner_type ?? null;
    this.ownerAddress = attrs.owner_address ?? null;
    this.mailingAddress = attrs.mailing_address ?? null;
    this.mailingCity = attrs.mailing_city ?? null;
    this.mailingState = attrs.mailing_state ?? null;
    this.mailingZip = attrs.mailing_zip ?? null;
    this.mailingCountry = attrs.mailing_country ?? null;
    this.sequenceOrder =
      attrs.sequence_order != null ? Number(attrs.sequence_order) : null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      lastYearObserved: this.lastYearObserved,
      ownerName: this.ownerName,
      ownerType: this.ownerType,
      ownerAddress: this.ownerAddress,
      mailingAddress: this.mailingAddress,
      mailingCity: this.mailingCity,
      mailingState: this.mailingState,
      mailingZip: this.mailingZip,
      mailingCountry: this.mailingCountry,
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
    lastYearObserved:
      attrs.last_year_observed != null ? Number(attrs.last_year_observed) : null,
    ownerName: attrs.owner_name ?? null,
    ownerType: attrs.owner_type ?? null,
    ownerAddress: attrs.owner_address ?? null,
    mailingAddress: attrs.mailing_address ?? null,
    mailingCity: attrs.mailing_city ?? null,
    mailingState: attrs.mailing_state ?? null,
    mailingZip: attrs.mailing_zip ?? null,
    mailingCountry: attrs.mailing_country ?? null,
    sequenceOrder:
      attrs.sequence_order != null ? Number(attrs.sequence_order) : null,
    createdAt: attrs.created_at
      ? new Date(attrs.created_at).toISOString()
      : null,
  };
}
