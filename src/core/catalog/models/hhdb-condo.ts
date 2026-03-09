export interface HhdbCondoProjectAttrs {
  tmk?: string | null;
  project_name?: string | null;
  unit_count?: number | null;
  dcca_link?: string | null;
  zoning?: string | null;
  address?: string | null;
  city?: string | null;
  developer?: string | null;
  project_number?: string | null;
  commercial?: number | null;
  tool_sheds?: number | null;
  ohana?: string | null;
  residential?: number | null;
  parking?: number | null;
  converted?: string | null;
  agricultural?: number | null;
  other?: number | null;
  buildings?: number | null;
  floors?: number | null;
  land_ownership?: string | null;
  preliminary_date?: Date | string | null;
  contingent_final_date?: Date | string | null;
  final_date?: Date | string | null;
  biennial_registration_date?: Date | string | null;
  created_at?: Date | string | null;
}

export class HhdbCondoProject {
  tmk: string | null;
  projectName: string | null;
  unitCount: number | null;
  dccaLink: string | null;
  zoning: string | null;
  address: string | null;
  city: string | null;
  developer: string | null;
  projectNumber: string | null;
  commercial: number | null;
  toolSheds: number | null;
  ohana: string | null;
  residential: number | null;
  parking: number | null;
  converted: string | null;
  agricultural: number | null;
  other: number | null;
  buildings: number | null;
  floors: number | null;
  landOwnership: string | null;
  preliminaryDate: Date | null;
  contingentFinalDate: Date | null;
  finalDate: Date | null;
  biennialRegistrationDate: Date | null;
  createdAt: Date | null;

  constructor(attrs: HhdbCondoProjectAttrs) {
    this.tmk = attrs.tmk ?? null;
    this.projectName = attrs.project_name ?? null;
    this.unitCount = attrs.unit_count != null ? Number(attrs.unit_count) : null;
    this.dccaLink = attrs.dcca_link ?? null;
    this.zoning = attrs.zoning ?? null;
    this.address = attrs.address ?? null;
    this.city = attrs.city ?? null;
    this.developer = attrs.developer ?? null;
    this.projectNumber = attrs.project_number ?? null;
    this.commercial =
      attrs.commercial != null ? Number(attrs.commercial) : null;
    this.toolSheds = attrs.tool_sheds != null ? Number(attrs.tool_sheds) : null;
    this.ohana = attrs.ohana ?? null;
    this.residential =
      attrs.residential != null ? Number(attrs.residential) : null;
    this.parking = attrs.parking != null ? Number(attrs.parking) : null;
    this.converted = attrs.converted ?? null;
    this.agricultural =
      attrs.agricultural != null ? Number(attrs.agricultural) : null;
    this.other = attrs.other != null ? Number(attrs.other) : null;
    this.buildings = attrs.buildings != null ? Number(attrs.buildings) : null;
    this.floors = attrs.floors != null ? Number(attrs.floors) : null;
    this.landOwnership = attrs.land_ownership ?? null;
    this.preliminaryDate = attrs.preliminary_date
      ? new Date(attrs.preliminary_date)
      : null;
    this.contingentFinalDate = attrs.contingent_final_date
      ? new Date(attrs.contingent_final_date)
      : null;
    this.finalDate = attrs.final_date ? new Date(attrs.final_date) : null;
    this.biennialRegistrationDate = attrs.biennial_registration_date
      ? new Date(attrs.biennial_registration_date)
      : null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
  }

  toJSON() {
    return {
      tmk: this.tmk,
      projectName: this.projectName,
      unitCount: this.unitCount,
      dccaLink: this.dccaLink,
      zoning: this.zoning,
      address: this.address,
      city: this.city,
      developer: this.developer,
      projectNumber: this.projectNumber,
      commercial: this.commercial,
      toolSheds: this.toolSheds,
      ohana: this.ohana,
      residential: this.residential,
      parking: this.parking,
      converted: this.converted,
      agricultural: this.agricultural,
      other: this.other,
      buildings: this.buildings,
      floors: this.floors,
      landOwnership: this.landOwnership,
      preliminaryDate: this.preliminaryDate?.toISOString() ?? null,
      contingentFinalDate: this.contingentFinalDate?.toISOString() ?? null,
      finalDate: this.finalDate?.toISOString() ?? null,
      biennialRegistrationDate:
        this.biennialRegistrationDate?.toISOString() ?? null,
      createdAt: this.createdAt?.toISOString() ?? null,
    };
  }
}

export type HhdbCondoProjectJSON = ReturnType<HhdbCondoProject["toJSON"]>;

export function hhdbCondoProjectRowToJSON(
  attrs: HhdbCondoProjectAttrs,
): HhdbCondoProjectJSON {
  return {
    tmk: attrs.tmk ?? null,
    projectName: attrs.project_name ?? null,
    unitCount: attrs.unit_count != null ? Number(attrs.unit_count) : null,
    dccaLink: attrs.dcca_link ?? null,
    zoning: attrs.zoning ?? null,
    address: attrs.address ?? null,
    city: attrs.city ?? null,
    developer: attrs.developer ?? null,
    projectNumber: attrs.project_number ?? null,
    commercial: attrs.commercial != null ? Number(attrs.commercial) : null,
    toolSheds: attrs.tool_sheds != null ? Number(attrs.tool_sheds) : null,
    ohana: attrs.ohana ?? null,
    residential: attrs.residential != null ? Number(attrs.residential) : null,
    parking: attrs.parking != null ? Number(attrs.parking) : null,
    converted: attrs.converted ?? null,
    agricultural:
      attrs.agricultural != null ? Number(attrs.agricultural) : null,
    other: attrs.other != null ? Number(attrs.other) : null,
    buildings: attrs.buildings != null ? Number(attrs.buildings) : null,
    floors: attrs.floors != null ? Number(attrs.floors) : null,
    landOwnership: attrs.land_ownership ?? null,
    preliminaryDate: attrs.preliminary_date
      ? new Date(attrs.preliminary_date).toISOString()
      : null,
    contingentFinalDate: attrs.contingent_final_date
      ? new Date(attrs.contingent_final_date).toISOString()
      : null,
    finalDate: attrs.final_date
      ? new Date(attrs.final_date).toISOString()
      : null,
    biennialRegistrationDate: attrs.biennial_registration_date
      ? new Date(attrs.biennial_registration_date).toISOString()
      : null,
    createdAt: attrs.created_at
      ? new Date(attrs.created_at).toISOString()
      : null,
  };
}

export interface HhdbCondoUnitAttrs {
  id?: number;
  tmk?: string | null;
  parent_tmk?: string | null;
  unit_number?: string | null;
  owner_name?: string | null;
  created_at?: Date | string | null;
}

export class HhdbCondoUnit {
  id: number;
  tmk: string | null;
  parentTmk: string | null;
  unitNumber: string | null;
  ownerName: string | null;
  createdAt: Date | null;

  constructor(attrs: HhdbCondoUnitAttrs) {
    this.id = attrs.id ?? 0;
    this.tmk = attrs.tmk ?? null;
    this.parentTmk = attrs.parent_tmk ?? null;
    this.unitNumber = attrs.unit_number ?? null;
    this.ownerName = attrs.owner_name ?? null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      parentTmk: this.parentTmk,
      unitNumber: this.unitNumber,
      ownerName: this.ownerName,
      createdAt: this.createdAt?.toISOString() ?? null,
    };
  }
}

export type HhdbCondoUnitJSON = ReturnType<HhdbCondoUnit["toJSON"]>;

export function hhdbCondoUnitRowToJSON(
  attrs: HhdbCondoUnitAttrs,
): HhdbCondoUnitJSON {
  return {
    id: attrs.id ?? 0,
    tmk: attrs.tmk ?? null,
    parentTmk: attrs.parent_tmk ?? null,
    unitNumber: attrs.unit_number ?? null,
    ownerName: attrs.owner_name ?? null,
    createdAt: attrs.created_at
      ? new Date(attrs.created_at).toISOString()
      : null,
  };
}
