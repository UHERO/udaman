export interface HhdbAssessmentAttrs {
  id?: number;
  tmk?: string | null;
  tax_year?: number | null;
  property_class?: string | null;
  assessed_land_value?: number | null;
  assessed_building_value?: number | null;
  dedicated_use_value?: number | null;
  land_exemption?: number | null;
  building_exemption?: number | null;
  net_taxable_land_value?: number | null;
  net_taxable_building_value?: number | null;
  total_property_assessed_value?: number | null;
  total_property_exemption?: number | null;
  total_net_taxable_value?: number | null;
  agricultural_land_value?: number | null;
  market_land_value?: number | null;
  market_building_value?: number | null;
  total_market_value?: number | null;
  created_at?: Date | string | null;
}

export class HhdbAssessment {
  id: number;
  tmk: string | null;
  taxYear: number | null;
  propertyClass: string | null;
  assessedLandValue: number | null;
  assessedBuildingValue: number | null;
  dedicatedUseValue: number | null;
  landExemption: number | null;
  buildingExemption: number | null;
  netTaxableLandValue: number | null;
  netTaxableBuildingValue: number | null;
  totalPropertyAssessedValue: number | null;
  totalPropertyExemption: number | null;
  totalNetTaxableValue: number | null;
  agriculturalLandValue: number | null;
  marketLandValue: number | null;
  marketBuildingValue: number | null;
  totalMarketValue: number | null;
  createdAt: Date | null;

  constructor(attrs: HhdbAssessmentAttrs) {
    this.id = attrs.id ?? 0;
    this.tmk = attrs.tmk ?? null;
    this.taxYear = attrs.tax_year != null ? Number(attrs.tax_year) : null;
    this.propertyClass = attrs.property_class ?? null;
    this.assessedLandValue = attrs.assessed_land_value != null ? Number(attrs.assessed_land_value) : null;
    this.assessedBuildingValue = attrs.assessed_building_value != null ? Number(attrs.assessed_building_value) : null;
    this.dedicatedUseValue = attrs.dedicated_use_value != null ? Number(attrs.dedicated_use_value) : null;
    this.landExemption = attrs.land_exemption != null ? Number(attrs.land_exemption) : null;
    this.buildingExemption = attrs.building_exemption != null ? Number(attrs.building_exemption) : null;
    this.netTaxableLandValue = attrs.net_taxable_land_value != null ? Number(attrs.net_taxable_land_value) : null;
    this.netTaxableBuildingValue = attrs.net_taxable_building_value != null ? Number(attrs.net_taxable_building_value) : null;
    this.totalPropertyAssessedValue = attrs.total_property_assessed_value != null ? Number(attrs.total_property_assessed_value) : null;
    this.totalPropertyExemption = attrs.total_property_exemption != null ? Number(attrs.total_property_exemption) : null;
    this.totalNetTaxableValue = attrs.total_net_taxable_value != null ? Number(attrs.total_net_taxable_value) : null;
    this.agriculturalLandValue = attrs.agricultural_land_value != null ? Number(attrs.agricultural_land_value) : null;
    this.marketLandValue = attrs.market_land_value != null ? Number(attrs.market_land_value) : null;
    this.marketBuildingValue = attrs.market_building_value != null ? Number(attrs.market_building_value) : null;
    this.totalMarketValue = attrs.total_market_value != null ? Number(attrs.total_market_value) : null;
    this.createdAt = attrs.created_at ? new Date(attrs.created_at) : null;
  }

  toJSON() {
    return {
      id: this.id,
      tmk: this.tmk,
      taxYear: this.taxYear,
      propertyClass: this.propertyClass,
      assessedLandValue: this.assessedLandValue,
      assessedBuildingValue: this.assessedBuildingValue,
      dedicatedUseValue: this.dedicatedUseValue,
      landExemption: this.landExemption,
      buildingExemption: this.buildingExemption,
      netTaxableLandValue: this.netTaxableLandValue,
      netTaxableBuildingValue: this.netTaxableBuildingValue,
      totalPropertyAssessedValue: this.totalPropertyAssessedValue,
      totalPropertyExemption: this.totalPropertyExemption,
      totalNetTaxableValue: this.totalNetTaxableValue,
      agriculturalLandValue: this.agriculturalLandValue,
      marketLandValue: this.marketLandValue,
      marketBuildingValue: this.marketBuildingValue,
      totalMarketValue: this.totalMarketValue,
      createdAt: this.createdAt?.toISOString() ?? null,
    };
  }
}

export type HhdbAssessmentJSON = ReturnType<HhdbAssessment["toJSON"]>;

export function hhdbAssessmentRowToJSON(attrs: HhdbAssessmentAttrs): HhdbAssessmentJSON {
  return {
    id: attrs.id ?? 0,
    tmk: attrs.tmk ?? null,
    taxYear: attrs.tax_year != null ? Number(attrs.tax_year) : null,
    propertyClass: attrs.property_class ?? null,
    assessedLandValue: attrs.assessed_land_value != null ? Number(attrs.assessed_land_value) : null,
    assessedBuildingValue: attrs.assessed_building_value != null ? Number(attrs.assessed_building_value) : null,
    dedicatedUseValue: attrs.dedicated_use_value != null ? Number(attrs.dedicated_use_value) : null,
    landExemption: attrs.land_exemption != null ? Number(attrs.land_exemption) : null,
    buildingExemption: attrs.building_exemption != null ? Number(attrs.building_exemption) : null,
    netTaxableLandValue: attrs.net_taxable_land_value != null ? Number(attrs.net_taxable_land_value) : null,
    netTaxableBuildingValue: attrs.net_taxable_building_value != null ? Number(attrs.net_taxable_building_value) : null,
    totalPropertyAssessedValue: attrs.total_property_assessed_value != null ? Number(attrs.total_property_assessed_value) : null,
    totalPropertyExemption: attrs.total_property_exemption != null ? Number(attrs.total_property_exemption) : null,
    totalNetTaxableValue: attrs.total_net_taxable_value != null ? Number(attrs.total_net_taxable_value) : null,
    agriculturalLandValue: attrs.agricultural_land_value != null ? Number(attrs.agricultural_land_value) : null,
    marketLandValue: attrs.market_land_value != null ? Number(attrs.market_land_value) : null,
    marketBuildingValue: attrs.market_building_value != null ? Number(attrs.market_building_value) : null,
    totalMarketValue: attrs.total_market_value != null ? Number(attrs.total_market_value) : null,
    createdAt: attrs.created_at ? new Date(attrs.created_at).toISOString() : null,
  };
}
