export interface HhdbParcelAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  parcel_number?: string | null;
  location_address?: string | null;
  address_other?: string | null;
  project_name?: string | null;
  legal_information?: string | null;
  property_class?: string | null;
  land_area_sqft?: number | null;
  land_area_acres?: number | null;
  neighborhood_code?: string | null;
  zoning?: string | null;
  parcel_note?: string | null;
  damage?: string | null;
  reentry_zone?: string | null;
  zone_color?: string | null;
  non_taxable_status?: string | null;
  living_units?: string | null;
  created_at?: Date | string | null;
}

export class HhdbParcel {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  parcelNumber: string | null;
  locationAddress: string | null;
  addressOther: string | null;
  projectName: string | null;
  legalInformation: string | null;
  propertyClass: string | null;
  landAreaSqft: number | null;
  landAreaAcres: number | null;
  neighborhoodCode: string | null;
  zoning: string | null;
  parcelNote: string | null;
  damage: string | null;
  reentryZone: string | null;
  zoneColor: string | null;
  nonTaxableStatus: string | null;
  livingUnits: string | null;
  createdAt: Date | null;

  constructor(attrs: HhdbParcelAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.parcelNumber = attrs.parcel_number ?? null;
    this.locationAddress = attrs.location_address ?? null;
    this.addressOther = attrs.address_other ?? null;
    this.projectName = attrs.project_name ?? null;
    this.legalInformation = attrs.legal_information ?? null;
    this.propertyClass = attrs.property_class ?? null;
    this.landAreaSqft = attrs.land_area_sqft != null ? Number(attrs.land_area_sqft) : null;
    this.landAreaAcres = attrs.land_area_acres != null ? Number(attrs.land_area_acres) : null;
    this.neighborhoodCode = attrs.neighborhood_code ?? null;
    this.zoning = attrs.zoning ?? null;
    this.parcelNote = attrs.parcel_note ?? null;
    this.damage = attrs.damage ?? null;
    this.reentryZone = attrs.reentry_zone ?? null;
    this.zoneColor = attrs.zone_color ?? null;
    this.nonTaxableStatus = attrs.non_taxable_status ?? null;
    this.livingUnits = attrs.living_units ?? null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      parcelNumber: this.parcelNumber,
      locationAddress: this.locationAddress,
      addressOther: this.addressOther,
      projectName: this.projectName,
      legalInformation: this.legalInformation,
      propertyClass: this.propertyClass,
      landAreaSqft: this.landAreaSqft,
      landAreaAcres: this.landAreaAcres,
      neighborhoodCode: this.neighborhoodCode,
      zoning: this.zoning,
      parcelNote: this.parcelNote,
      damage: this.damage,
      reentryZone: this.reentryZone,
      zoneColor: this.zoneColor,
      nonTaxableStatus: this.nonTaxableStatus,
      livingUnits: this.livingUnits,
      createdAt: this.createdAt?.toISOString() ?? null,
    };
  }
}

export type HhdbParcelJSON = ReturnType<HhdbParcel["toJSON"]>;

export function hhdbParcelRowToJSON(attrs: HhdbParcelAttrs): HhdbParcelJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    scrapedAt: attrs.scraped_at ? new Date(attrs.scraped_at).toISOString() : null,
    parcelNumber: attrs.parcel_number ?? null,
    locationAddress: attrs.location_address ?? null,
    addressOther: attrs.address_other ?? null,
    projectName: attrs.project_name ?? null,
    legalInformation: attrs.legal_information ?? null,
    propertyClass: attrs.property_class ?? null,
    landAreaSqft: attrs.land_area_sqft != null ? Number(attrs.land_area_sqft) : null,
    landAreaAcres: attrs.land_area_acres != null ? Number(attrs.land_area_acres) : null,
    neighborhoodCode: attrs.neighborhood_code ?? null,
    zoning: attrs.zoning ?? null,
    parcelNote: attrs.parcel_note ?? null,
    damage: attrs.damage ?? null,
    reentryZone: attrs.reentry_zone ?? null,
    zoneColor: attrs.zone_color ?? null,
    nonTaxableStatus: attrs.non_taxable_status ?? null,
    livingUnits: attrs.living_units ?? null,
    createdAt: attrs.created_at ? new Date(attrs.created_at).toISOString() : null,
  };
}
