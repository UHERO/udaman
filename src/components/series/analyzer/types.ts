export interface AnalyzerEntry {
  id: string;
  /** e.g. '"E_NF@HI.M".ts' or '"A".ts.zero_add "B".ts' */
  expression: string;
  /** Original series name for display */
  name: string;
  data: [string, number][];
  unitShortLabel: string | null;
  decimals: number;
  frequencyCode: string | null;
  visibility: "active" | "gray" | "hidden";
  axis: "left" | "right";
  loading: boolean;
  error: string | null;
}
