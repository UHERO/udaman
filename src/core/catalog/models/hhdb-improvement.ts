/** Shared attrs for both residential and commercial improvements */
export interface HhdbImprovementAttrs {
  id?: number;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  building_number?: string | null;
  year_built?: number | null;
  // Residential fields
  eff_year_built?: number | null;
  living_area?: string | null;
  bedrooms?: string | null;
  full_bath?: string | null;
  half_bath?: string | null;
  occupancy?: string | null;
  framing?: string | null;
  percent_complete?: string | null;
  heating_cooling?: string | null;
  exterior_wall?: string | null;
  roof_material?: string | null;
  grade?: string | null;
  building_value?: number | null;
  total_room_count?: string | null;
  condo_style?: string | null;
  // Commercial fields
  building_card?: string | null;
  effective_year_built?: number | null;
  improvement_name?: string | null;
  property_class?: string | null;
  structure_type?: string | null;
  units?: string | null;
  building_square_footage?: string | null;
  building_type?: string | null;
  structure?: string | null;
  value?: number | null;
}

export class HhdbImprovement {
  id: number;
  tmk: string | null;
  buildingNumber: string | null;
  yearBuilt: number | null;
  // Residential
  effYearBuilt: number | null;
  livingArea: string | null;
  bedrooms: string | null;
  fullBath: string | null;
  halfBath: string | null;
  occupancy: string | null;
  framing: string | null;
  grade: string | null;
  buildingValue: number | null;
  totalRoomCount: string | null;
  // Commercial
  improvementName: string | null;
  propertyClass: string | null;
  structureType: string | null;
  units: string | null;
  buildingSquareFootage: string | null;
  buildingType: string | null;
  value: number | null;

  constructor(attrs: HhdbImprovementAttrs) {
    this.id = attrs.id ?? 0;
    this.tmk = attrs.tmk ?? null;
    this.buildingNumber = attrs.building_number ?? null;
    this.yearBuilt = attrs.year_built != null ? Number(attrs.year_built) : null;
    // Residential
    this.effYearBuilt = attrs.eff_year_built != null ? Number(attrs.eff_year_built) : null;
    this.livingArea = attrs.living_area ?? null;
    this.bedrooms = attrs.bedrooms ?? null;
    this.fullBath = attrs.full_bath ?? null;
    this.halfBath = attrs.half_bath ?? null;
    this.occupancy = attrs.occupancy ?? null;
    this.framing = attrs.framing ?? null;
    this.grade = attrs.grade ?? null;
    this.buildingValue = attrs.building_value != null ? Number(attrs.building_value) : null;
    this.totalRoomCount = attrs.total_room_count ?? null;
    // Commercial
    this.improvementName = attrs.improvement_name ?? null;
    this.propertyClass = attrs.property_class ?? null;
    this.structureType = attrs.structure_type ?? null;
    this.units = attrs.units ?? null;
    this.buildingSquareFootage = attrs.building_square_footage ?? null;
    this.buildingType = attrs.building_type ?? null;
    this.value = attrs.value != null ? Number(attrs.value) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      buildingNumber: this.buildingNumber,
      yearBuilt: this.yearBuilt,
      effYearBuilt: this.effYearBuilt,
      livingArea: this.livingArea,
      bedrooms: this.bedrooms,
      fullBath: this.fullBath,
      halfBath: this.halfBath,
      occupancy: this.occupancy,
      framing: this.framing,
      grade: this.grade,
      buildingValue: this.buildingValue,
      totalRoomCount: this.totalRoomCount,
      improvementName: this.improvementName,
      propertyClass: this.propertyClass,
      structureType: this.structureType,
      units: this.units,
      buildingSquareFootage: this.buildingSquareFootage,
      buildingType: this.buildingType,
      value: this.value,
    };
  }
}

export type HhdbImprovementJSON = ReturnType<HhdbImprovement["toJSON"]>;

export function hhdbImprovementRowToJSON(attrs: HhdbImprovementAttrs): HhdbImprovementJSON {
  return {
    id: attrs.id ?? 0,
    tmk: attrs.tmk ?? null,
    buildingNumber: attrs.building_number ?? null,
    yearBuilt: attrs.year_built != null ? Number(attrs.year_built) : null,
    effYearBuilt: attrs.eff_year_built != null ? Number(attrs.eff_year_built) : null,
    livingArea: attrs.living_area ?? null,
    bedrooms: attrs.bedrooms ?? null,
    fullBath: attrs.full_bath ?? null,
    halfBath: attrs.half_bath ?? null,
    occupancy: attrs.occupancy ?? null,
    framing: attrs.framing ?? null,
    grade: attrs.grade ?? null,
    buildingValue: attrs.building_value != null ? Number(attrs.building_value) : null,
    totalRoomCount: attrs.total_room_count ?? null,
    improvementName: attrs.improvement_name ?? null,
    propertyClass: attrs.property_class ?? null,
    structureType: attrs.structure_type ?? null,
    units: attrs.units ?? null,
    buildingSquareFootage: attrs.building_square_footage ?? null,
    buildingType: attrs.building_type ?? null,
    value: attrs.value != null ? Number(attrs.value) : null,
  };
}
