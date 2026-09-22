export interface SuperTableSeriesEntry {
  seriesId: number;
  seriesName: string;
  measurementId: number;
  measurementPrefix: string;
  dataPortalName: string | null;
  listOrder: number;
  indent: string;
  decimals: number;
  frequencyCode: string | null;
  frequency: string | null;
  unitShortLabel: string | null;
  data: [string, number][]; // sorted [date, value] tuples
}

export interface SuperTableData {
  dataList: { id: number; name: string | null; universe: string };
  series: SuperTableSeriesEntry[];
  allDates: string[];
  geographies: Array<{ handle: string; displayName: string | null }>;
  availableFrequencies: Array<{ code: string; label: string }>;
  filters: { freq: string; geo: string; sa: string };
}
