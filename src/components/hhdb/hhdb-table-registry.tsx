"use client";

import type { HhdbListParams } from "@catalog/types/hhdb";

import {
  getHhdbProperties,
  getHhdbAssessments,
  getHhdbSales,
  getHhdbResidentialImprovements,
  getHhdbCommercialImprovements,
  getHhdbPermits,
  getHhdbCondoProjects,
  getHhdbCondoUnits,
  getHhdbParcels,
  getHhdbOwners,
  getHhdbAppeals,
  getHhdbDedications,
  getHhdbLandClassifications,
  getHhdbCurrentTaxBills,
  getHhdbHistoricalTaxSummary,
  getHhdbHistoricalTaxDetails,
  getHhdbHistoricalTaxPayments,
  getHhdbHistoricalTaxCredits,
  getHhdbAgriculturalAssessments,
  getHhdbCommercialDetails,
  getHhdbResidentialAdditions,
  getHhdbAccessoryStructures,
  getHhdbYardImprovements,
} from "@/actions/hhdb";

import { PropertiesTable } from "@/components/hhdb/tables/properties-table";
import { AssessmentsTable } from "@/components/hhdb/tables/assessments-table";
import { SalesTable } from "@/components/hhdb/tables/sales-table";
import { ImprovementsTable } from "@/components/hhdb/tables/improvements-table";
import { PermitsTable } from "@/components/hhdb/tables/permits-table";
import { CondoProjectsTable, CondoUnitsTable } from "@/components/hhdb/tables/condos-table";
import { ParcelsTable } from "@/components/hhdb/tables/parcels-table";
import { OwnersTable } from "@/components/hhdb/tables/owners-table";
import { AppealsTable } from "@/components/hhdb/tables/appeals-table";
import { DedicationsTable } from "@/components/hhdb/tables/dedications-table";
import { LandClassificationsTable } from "@/components/hhdb/tables/land-classifications-table";
import { CurrentTaxBillsTable } from "@/components/hhdb/tables/current-tax-bills-table";
import { HistoricalTaxSummaryTable } from "@/components/hhdb/tables/historical-tax-summary-table";
import { HistoricalTaxDetailsTable } from "@/components/hhdb/tables/historical-tax-details-table";
import { HistoricalTaxPaymentsTable } from "@/components/hhdb/tables/historical-tax-payments-table";
import { HistoricalTaxCreditsTable } from "@/components/hhdb/tables/historical-tax-credits-table";
import { AgriculturalAssessmentsTable } from "@/components/hhdb/tables/agricultural-assessments-table";
import { CommercialDetailsTable } from "@/components/hhdb/tables/commercial-details-table";
import { ResidentialAdditionsTable } from "@/components/hhdb/tables/residential-additions-table";
import { AccessoryStructuresTable } from "@/components/hhdb/tables/accessory-structures-table";
import { YardImprovementsTable } from "@/components/hhdb/tables/yard-improvements-table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionFn = (params: HhdbListParams) => Promise<{ rows: any[]; total: number }>;

interface TableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  total: number;
  page: number;
  limit: number;
  search: string;
  sort: string;
  order: "asc" | "desc";
}

interface TableEntry {
  action: ActionFn;
  render: (props: TableProps) => React.ReactNode;
}

const REGISTRY: Record<string, TableEntry> = {
  properties: {
    action: getHhdbProperties,
    render: (p) => <PropertiesTable {...p} />,
  },
  assessments: {
    action: getHhdbAssessments,
    render: (p) => <AssessmentsTable {...p} />,
  },
  sales: {
    action: getHhdbSales,
    render: (p) => <SalesTable {...p} />,
  },
  "residential-improvements": {
    action: getHhdbResidentialImprovements,
    render: (p) => <ImprovementsTable {...p} type="residential" />,
  },
  "commercial-improvements": {
    action: getHhdbCommercialImprovements,
    render: (p) => <ImprovementsTable {...p} type="commercial" />,
  },
  permits: {
    action: getHhdbPermits,
    render: (p) => <PermitsTable {...p} />,
  },
  "condo-projects": {
    action: getHhdbCondoProjects,
    render: (p) => <CondoProjectsTable {...p} />,
  },
  "condo-units": {
    action: getHhdbCondoUnits,
    render: (p) => <CondoUnitsTable {...p} />,
  },
  parcels: {
    action: getHhdbParcels,
    render: (p) => <ParcelsTable {...p} />,
  },
  owners: {
    action: getHhdbOwners,
    render: (p) => <OwnersTable {...p} />,
  },
  appeals: {
    action: getHhdbAppeals,
    render: (p) => <AppealsTable {...p} />,
  },
  dedications: {
    action: getHhdbDedications,
    render: (p) => <DedicationsTable {...p} />,
  },
  "land-classifications": {
    action: getHhdbLandClassifications,
    render: (p) => <LandClassificationsTable {...p} />,
  },
  "tax-bills": {
    action: getHhdbCurrentTaxBills,
    render: (p) => <CurrentTaxBillsTable {...p} />,
  },
  "tax-summary": {
    action: getHhdbHistoricalTaxSummary,
    render: (p) => <HistoricalTaxSummaryTable {...p} />,
  },
  "tax-details": {
    action: getHhdbHistoricalTaxDetails,
    render: (p) => <HistoricalTaxDetailsTable {...p} />,
  },
  "tax-payments": {
    action: getHhdbHistoricalTaxPayments,
    render: (p) => <HistoricalTaxPaymentsTable {...p} />,
  },
  "tax-credits": {
    action: getHhdbHistoricalTaxCredits,
    render: (p) => <HistoricalTaxCreditsTable {...p} />,
  },
  "ag-assessments": {
    action: getHhdbAgriculturalAssessments,
    render: (p) => <AgriculturalAssessmentsTable {...p} />,
  },
  "accessory-structures": {
    action: getHhdbAccessoryStructures,
    render: (p) => <AccessoryStructuresTable {...p} />,
  },
  "commercial-details": {
    action: getHhdbCommercialDetails,
    render: (p) => <CommercialDetailsTable {...p} />,
  },
  "residential-additions": {
    action: getHhdbResidentialAdditions,
    render: (p) => <ResidentialAdditionsTable {...p} />,
  },
  "yard-improvements": {
    action: getHhdbYardImprovements,
    render: (p) => <YardImprovementsTable {...p} />,
  },
};

export function getTableAction(slug: string): ActionFn | null {
  return REGISTRY[slug]?.action ?? null;
}

export function renderTable(slug: string, props: TableProps): React.ReactNode {
  return REGISTRY[slug]?.render(props) ?? null;
}
