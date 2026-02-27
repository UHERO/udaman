export interface HhdbPropertyAttrs {
  tmk?: string | null;
  island_code?: string | null;
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
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
}

export class HhdbProperty {
  tmk: string | null;
  islandCode: string | null;
  parcelNumber: string | null;
  locationAddress: string | null;
  addressOther: string | null;
  projectName: string | null;
  propertyClass: string | null;
  landAreaSqft: number | null;
  landAreaAcres: number | null;
  neighborhoodCode: string | null;
  zoning: string | null;
  damage: string | null;
  nonTaxableStatus: string | null;
  livingUnits: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;

  constructor(attrs: HhdbPropertyAttrs) {
    this.tmk = attrs.tmk ?? null;
    this.islandCode = attrs.island_code ?? null;
    this.parcelNumber = attrs.parcel_number ?? null;
    this.locationAddress = attrs.location_address ?? null;
    this.addressOther = attrs.address_other ?? null;
    this.projectName = attrs.project_name ?? null;
    this.propertyClass = attrs.property_class ?? null;
    this.landAreaSqft = attrs.land_area_sqft != null ? Number(attrs.land_area_sqft) : null;
    this.landAreaAcres = attrs.land_area_acres != null ? Number(attrs.land_area_acres) : null;
    this.neighborhoodCode = attrs.neighborhood_code ?? null;
    this.zoning = attrs.zoning ?? null;
    this.damage = attrs.damage ?? null;
    this.nonTaxableStatus = attrs.non_taxable_status ?? null;
    this.livingUnits = attrs.living_units ?? null;
    this.zip = attrs.zip ?? null;
    this.latitude = attrs.latitude != null ? Number(attrs.latitude) : null;
    this.longitude = attrs.longitude != null ? Number(attrs.longitude) : null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
    this.updatedAt = attrs.updated_at ? new Date(attrs.updated_at) : null;
  }

  toJSON() {
    return {
      tmk: this.tmk,
      islandCode: this.islandCode,
      parcelNumber: this.parcelNumber,
      locationAddress: this.locationAddress,
      addressOther: this.addressOther,
      projectName: this.projectName,
      propertyClass: this.propertyClass,
      landAreaSqft: this.landAreaSqft,
      landAreaAcres: this.landAreaAcres,
      neighborhoodCode: this.neighborhoodCode,
      zoning: this.zoning,
      damage: this.damage,
      nonTaxableStatus: this.nonTaxableStatus,
      livingUnits: this.livingUnits,
      zip: this.zip,
      latitude: this.latitude,
      longitude: this.longitude,
      createdAt: this.createdAt?.toISOString() ?? null,
      updatedAt: this.updatedAt?.toISOString() ?? null,
    };
  }
}

export type HhdbPropertyJSON = ReturnType<HhdbProperty["toJSON"]>;

export function hhdbPropertyRowToJSON(attrs: HhdbPropertyAttrs): HhdbPropertyJSON {
  return {
    tmk: attrs.tmk ?? null,
    islandCode: attrs.island_code ?? null,
    parcelNumber: attrs.parcel_number ?? null,
    locationAddress: attrs.location_address ?? null,
    addressOther: attrs.address_other ?? null,
    projectName: attrs.project_name ?? null,
    propertyClass: attrs.property_class ?? null,
    landAreaSqft: attrs.land_area_sqft != null ? Number(attrs.land_area_sqft) : null,
    landAreaAcres: attrs.land_area_acres != null ? Number(attrs.land_area_acres) : null,
    neighborhoodCode: attrs.neighborhood_code ?? null,
    zoning: attrs.zoning ?? null,
    damage: attrs.damage ?? null,
    nonTaxableStatus: attrs.non_taxable_status ?? null,
    livingUnits: attrs.living_units ?? null,
    zip: attrs.zip ?? null,
    latitude: attrs.latitude != null ? Number(attrs.latitude) : null,
    longitude: attrs.longitude != null ? Number(attrs.longitude) : null,
    createdAt: attrs.created_at ? new Date(attrs.created_at).toISOString() : null,
    updatedAt: attrs.updated_at ? new Date(attrs.updated_at).toISOString() : null,
  };
}
