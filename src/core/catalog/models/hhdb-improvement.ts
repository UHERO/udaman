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
  fireplace?: string | null;
  grade?: string | null;
  building_value?: number | null;
  total_room_count?: string | null;
  condo_style?: string | null;
  condo_view?: string | null;
  floor_level?: string | null;
  parking_spaces?: string | null;
  // Commercial fields
  building_card?: string | null;
  effective_year_built?: number | null;
  improvement_name?: string | null;
  property_class?: string | null;
  structure_type?: string | null;
  units?: string | null;
  identical_units?: string | null;
  gross_building_description?: string | null;
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
  percentComplete: string | null;
  heatingCooling: string | null;
  exteriorWall: string | null;
  roofMaterial: string | null;
  fireplace: string | null;
  grade: string | null;
  buildingValue: number | null;
  totalRoomCount: string | null;
  condoStyle: string | null;
  condoView: string | null;
  floorLevel: string | null;
  parkingSpaces: string | null;
  // Commercial
  buildingCard: string | null;
  effectiveYearBuilt: number | null;
  improvementName: string | null;
  propertyClass: string | null;
  structureType: string | null;
  units: string | null;
  identicalUnits: string | null;
  grossBuildingDescription: string | null;
  buildingSquareFootage: string | null;
  buildingType: string | null;
  percentCompleteComm: string | null;
  structure: string | null;
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
    this.percentComplete = attrs.percent_complete ?? null;
    this.heatingCooling = attrs.heating_cooling ?? null;
    this.exteriorWall = attrs.exterior_wall ?? null;
    this.roofMaterial = attrs.roof_material ?? null;
    this.fireplace = attrs.fireplace ?? null;
    this.grade = attrs.grade ?? null;
    this.buildingValue = attrs.building_value != null ? Number(attrs.building_value) : null;
    this.totalRoomCount = attrs.total_room_count ?? null;
    this.condoStyle = attrs.condo_style ?? null;
    this.condoView = attrs.condo_view ?? null;
    this.floorLevel = attrs.floor_level ?? null;
    this.parkingSpaces = attrs.parking_spaces ?? null;
    // Commercial
    this.buildingCard = attrs.building_card ?? null;
    this.effectiveYearBuilt = attrs.effective_year_built != null ? Number(attrs.effective_year_built) : null;
    this.improvementName = attrs.improvement_name ?? null;
    this.propertyClass = attrs.property_class ?? null;
    this.structureType = attrs.structure_type ?? null;
    this.units = attrs.units ?? null;
    this.identicalUnits = attrs.identical_units ?? null;
    this.grossBuildingDescription = attrs.gross_building_description ?? null;
    this.buildingSquareFootage = attrs.building_square_footage ?? null;
    this.buildingType = attrs.building_type ?? null;
    this.percentCompleteComm = attrs.percent_complete ?? null;
    this.structure = attrs.structure ?? null;
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
      percentComplete: this.percentComplete,
      heatingCooling: this.heatingCooling,
      exteriorWall: this.exteriorWall,
      roofMaterial: this.roofMaterial,
      fireplace: this.fireplace,
      grade: this.grade,
      buildingValue: this.buildingValue,
      totalRoomCount: this.totalRoomCount,
      condoStyle: this.condoStyle,
      condoView: this.condoView,
      floorLevel: this.floorLevel,
      parkingSpaces: this.parkingSpaces,
      buildingCard: this.buildingCard,
      effectiveYearBuilt: this.effectiveYearBuilt,
      improvementName: this.improvementName,
      propertyClass: this.propertyClass,
      structureType: this.structureType,
      units: this.units,
      identicalUnits: this.identicalUnits,
      grossBuildingDescription: this.grossBuildingDescription,
      buildingSquareFootage: this.buildingSquareFootage,
      buildingType: this.buildingType,
      percentCompleteComm: this.percentCompleteComm,
      structure: this.structure,
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
    percentComplete: attrs.percent_complete ?? null,
    heatingCooling: attrs.heating_cooling ?? null,
    exteriorWall: attrs.exterior_wall ?? null,
    roofMaterial: attrs.roof_material ?? null,
    fireplace: attrs.fireplace ?? null,
    grade: attrs.grade ?? null,
    buildingValue: attrs.building_value != null ? Number(attrs.building_value) : null,
    totalRoomCount: attrs.total_room_count ?? null,
    condoStyle: attrs.condo_style ?? null,
    condoView: attrs.condo_view ?? null,
    floorLevel: attrs.floor_level ?? null,
    parkingSpaces: attrs.parking_spaces ?? null,
    buildingCard: attrs.building_card ?? null,
    effectiveYearBuilt: attrs.effective_year_built != null ? Number(attrs.effective_year_built) : null,
    improvementName: attrs.improvement_name ?? null,
    propertyClass: attrs.property_class ?? null,
    structureType: attrs.structure_type ?? null,
    units: attrs.units ?? null,
    identicalUnits: attrs.identical_units ?? null,
    grossBuildingDescription: attrs.gross_building_description ?? null,
    buildingSquareFootage: attrs.building_square_footage ?? null,
    buildingType: attrs.building_type ?? null,
    percentCompleteComm: attrs.percent_complete ?? null,
    structure: attrs.structure ?? null,
    value: attrs.value != null ? Number(attrs.value) : null,
  };
}
