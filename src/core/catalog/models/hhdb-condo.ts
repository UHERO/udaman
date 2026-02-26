export interface HhdbCondoProjectAttrs {
  tmk?: string | null;
  project_name?: string | null;
  unit_count?: number | null;
  zoning?: string | null;
  address?: string | null;
  city?: string | null;
  developer?: string | null;
  project_number?: string | null;
  residential?: number | null;
  commercial?: number | null;
  parking?: number | null;
  buildings?: number | null;
  floors?: number | null;
  land_ownership?: string | null;
  final_date?: Date | string | null;
  created_at?: Date | string | null;
}

export class HhdbCondoProject {
  tmk: string | null;
  projectName: string | null;
  unitCount: number | null;
  zoning: string | null;
  address: string | null;
  city: string | null;
  developer: string | null;
  projectNumber: string | null;
  residential: number | null;
  commercial: number | null;
  parking: number | null;
  buildings: number | null;
  floors: number | null;
  landOwnership: string | null;
  finalDate: Date | null;
  createdAt: Date | null;

  constructor(attrs: HhdbCondoProjectAttrs) {
    this.tmk = attrs.tmk ?? null;
    this.projectName = attrs.project_name ?? null;
    this.unitCount = attrs.unit_count != null ? Number(attrs.unit_count) : null;
    this.zoning = attrs.zoning ?? null;
    this.address = attrs.address ?? null;
    this.city = attrs.city ?? null;
    this.developer = attrs.developer ?? null;
    this.projectNumber = attrs.project_number ?? null;
    this.residential = attrs.residential != null ? Number(attrs.residential) : null;
    this.commercial = attrs.commercial != null ? Number(attrs.commercial) : null;
    this.parking = attrs.parking != null ? Number(attrs.parking) : null;
    this.buildings = attrs.buildings != null ? Number(attrs.buildings) : null;
    this.floors = attrs.floors != null ? Number(attrs.floors) : null;
    this.landOwnership = attrs.land_ownership ?? null;
    this.finalDate = attrs.final_date ? new Date(attrs.final_date) : null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
  }

  toJSON() {
    return {
      tmk: this.tmk,
      projectName: this.projectName,
      unitCount: this.unitCount,
      zoning: this.zoning,
      address: this.address,
      city: this.city,
      developer: this.developer,
      projectNumber: this.projectNumber,
      residential: this.residential,
      commercial: this.commercial,
      parking: this.parking,
      buildings: this.buildings,
      floors: this.floors,
      landOwnership: this.landOwnership,
      finalDate: this.finalDate?.toISOString() ?? null,
      createdAt: this.createdAt?.toISOString() ?? null,
    };
  }
}

export type HhdbCondoProjectJSON = ReturnType<HhdbCondoProject["toJSON"]>;

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
