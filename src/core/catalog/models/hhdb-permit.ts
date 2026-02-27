export interface HhdbPermitAttrs {
  id?: number;
  tmk?: string | null;
  permit_date?: Date | string | null;
  permit_number?: string | null;
  reason?: string | null;
  permit_amount?: number | null;
}

export class HhdbPermit {
  id: number;
  tmk: string | null;
  permitDate: Date | null;
  permitNumber: string | null;
  reason: string | null;
  permitAmount: number | null;

  constructor(attrs: HhdbPermitAttrs) {
    this.id = attrs.id ?? 0;
    this.tmk = attrs.tmk ?? null;
    this.permitDate = attrs.permit_date ? new Date(attrs.permit_date) : null;
    this.permitNumber = attrs.permit_number ?? null;
    this.reason = attrs.reason ?? null;
    this.permitAmount = attrs.permit_amount != null ? Number(attrs.permit_amount) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      permitDate: this.permitDate?.toISOString() ?? null,
      permitNumber: this.permitNumber,
      reason: this.reason,
      permitAmount: this.permitAmount,
    };
  }
}

export type HhdbPermitJSON = ReturnType<HhdbPermit["toJSON"]>;

export function hhdbPermitRowToJSON(attrs: HhdbPermitAttrs): HhdbPermitJSON {
  return {
    id: attrs.id ?? 0,
    tmk: attrs.tmk ?? null,
    permitDate: attrs.permit_date ? new Date(attrs.permit_date).toISOString() : null,
    permitNumber: attrs.permit_number ?? null,
    reason: attrs.reason ?? null,
    permitAmount: attrs.permit_amount != null ? Number(attrs.permit_amount) : null,
  };
}
