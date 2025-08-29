export interface SeriesFull {
  id: number;
  xseries_id: number;
  geography_id: number;
  unit_id: number;
  source_id: number;
  source_detail_id: number | null;
  universe: string;
  decimals: number;
  name: string;
  dataPortalName: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  dependency_depth: number;
  source_link: string | null;
  investigation_notes: string | null;
  scratch: number;
}
