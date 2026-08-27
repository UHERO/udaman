export interface HhdbCommercialDetailAttrs {
  id?: number | null;
  commercial_improvement_id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  card?: number | null;
  section?: string | null;
  floor?: string | null;
  usage?: string | null;
  area?: string | null;
  perimeter?: number | null;
  exterior_wall?: string | null;
  wall_height?: number | null;
  construction?: string | null;
  rank?: number | null;
  condo_style?: string | null;
  condo_type?: string | null;
  condo_unit?: string | null;
  floor_level?: string | null;
  view?: string | null;
  project?: string | null;
  description?: string | null;
}

export class HhdbCommercialDetail {
  id: number | null;
  commercialImprovementId: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  card: number | null;
  section: string | null;
  floor: string | null;
  usage: string | null;
  area: string | null;
  perimeter: number | null;
  exteriorWall: string | null;
  wallHeight: number | null;
  construction: string | null;
  rank: number | null;
  condoStyle: string | null;
  condoType: string | null;
  condoUnit: string | null;
  floorLevel: string | null;
  view: string | null;
  project: string | null;
  description: string | null;

  constructor(attrs: HhdbCommercialDetailAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.commercialImprovementId =
      attrs.commercial_improvement_id != null
        ? Number(attrs.commercial_improvement_id)
        : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.card = attrs.card != null ? Number(attrs.card) : null;
    this.section = attrs.section ?? null;
    this.floor = attrs.floor ?? null;
    this.usage = attrs.usage ?? null;
    this.area = attrs.area ?? null;
    this.perimeter = attrs.perimeter != null ? Number(attrs.perimeter) : null;
    this.exteriorWall = attrs.exterior_wall ?? null;
    this.wallHeight =
      attrs.wall_height != null ? Number(attrs.wall_height) : null;
    this.construction = attrs.construction ?? null;
    this.rank = attrs.rank != null ? Number(attrs.rank) : null;
    this.condoStyle = attrs.condo_style ?? null;
    this.condoType = attrs.condo_type ?? null;
    this.condoUnit = attrs.condo_unit ?? null;
    this.floorLevel = attrs.floor_level ?? null;
    this.view = attrs.view ?? null;
    this.project = attrs.project ?? null;
    this.description = attrs.description ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      commercialImprovementId: this.commercialImprovementId,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      card: this.card,
      section: this.section,
      floor: this.floor,
      usage: this.usage,
      area: this.area,
      perimeter: this.perimeter,
      exteriorWall: this.exteriorWall,
      wallHeight: this.wallHeight,
      construction: this.construction,
      rank: this.rank,
      condoStyle: this.condoStyle,
      condoType: this.condoType,
      condoUnit: this.condoUnit,
      floorLevel: this.floorLevel,
      view: this.view,
      project: this.project,
      description: this.description,
    };
  }
}

export type HhdbCommercialDetailJSON = ReturnType<
  HhdbCommercialDetail["toJSON"]
>;

export function hhdbCommercialDetailRowToJSON(
  attrs: HhdbCommercialDetailAttrs,
): HhdbCommercialDetailJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    commercialImprovementId:
      attrs.commercial_improvement_id != null
        ? Number(attrs.commercial_improvement_id)
        : null,
    tmk: attrs.tmk ?? null,
    scrapedAt: attrs.scraped_at
      ? new Date(attrs.scraped_at).toISOString()
      : null,
    card: attrs.card != null ? Number(attrs.card) : null,
    section: attrs.section ?? null,
    floor: attrs.floor ?? null,
    usage: attrs.usage ?? null,
    area: attrs.area ?? null,
    perimeter: attrs.perimeter != null ? Number(attrs.perimeter) : null,
    exteriorWall: attrs.exterior_wall ?? null,
    wallHeight: attrs.wall_height != null ? Number(attrs.wall_height) : null,
    construction: attrs.construction ?? null,
    rank: attrs.rank != null ? Number(attrs.rank) : null,
    condoStyle: attrs.condo_style ?? null,
    condoType: attrs.condo_type ?? null,
    condoUnit: attrs.condo_unit ?? null,
    floorLevel: attrs.floor_level ?? null,
    view: attrs.view ?? null,
    project: attrs.project ?? null,
    description: attrs.description ?? null,
  };
}
