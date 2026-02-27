export interface HhdbResidentialAdditionAttrs {
  id?: number | null;
  tmk?: string | null;
  scraped_at?: Date | string | null;
  card?: string | null;
  line?: string | null;
  lower?: string | null;
  first?: string | null;
  second?: string | null;
  third?: string | null;
  area?: string | null;
}

export class HhdbResidentialAddition {
  id: number | null;
  tmk: string | null;
  scrapedAt: Date | null;
  card: string | null;
  line: string | null;
  lower: string | null;
  first: string | null;
  second: string | null;
  third: string | null;
  area: string | null;

  constructor(attrs: HhdbResidentialAdditionAttrs) {
    this.id = attrs.id != null ? Number(attrs.id) : null;
    this.tmk = attrs.tmk ?? null;
    this.scrapedAt = attrs.scraped_at ? new Date(attrs.scraped_at) : null;
    this.card = attrs.card ?? null;
    this.line = attrs.line ?? null;
    this.lower = attrs.lower ?? null;
    this.first = attrs.first ?? null;
    this.second = attrs.second ?? null;
    this.third = attrs.third ?? null;
    this.area = attrs.area ?? null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      scrapedAt: this.scrapedAt?.toISOString() ?? null,
      card: this.card,
      line: this.line,
      lower: this.lower,
      first: this.first,
      second: this.second,
      third: this.third,
      area: this.area,
    };
  }
}

export type HhdbResidentialAdditionJSON = ReturnType<HhdbResidentialAddition["toJSON"]>;

export function hhdbResidentialAdditionRowToJSON(attrs: HhdbResidentialAdditionAttrs): HhdbResidentialAdditionJSON {
  return {
    id: attrs.id != null ? Number(attrs.id) : null,
    tmk: attrs.tmk ?? null,
    scrapedAt: attrs.scraped_at ? new Date(attrs.scraped_at).toISOString() : null,
    card: attrs.card ?? null,
    line: attrs.line ?? null,
    lower: attrs.lower ?? null,
    first: attrs.first ?? null,
    second: attrs.second ?? null,
    third: attrs.third ?? null,
    area: attrs.area ?? null,
  };
}
