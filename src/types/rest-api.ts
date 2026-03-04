interface BaseResponse {
  series: Series;
}

export interface ExpandedSeries extends BaseResponse {
  observations: Observations;
}

export interface Series {
  id: number; //411494;
  name: string; //"CPIRPP0000@US.M";
  universe: string; //"UHERO";
  title: string; //"CPI RPP US City Average";
  description: string; //"CPI RPP US City Average";
  frequency: "Monthly" | "Quarterly" | "Annually"; //"Monthly";
  frequencyShort: "M" | "Q" | "A"; //"M";
  seasonalAdjustment: SeasonalAdjustment;
  unitsLabel: string; //"Index Value (US Avg=100)";
  unitsLabelShort: string; // "Index";
  geography: {
    name: string; // "United States of America";
    shortName: string; // "USA";
    handle: string; // "US";
  };
  percent: boolean; //  false;
  decimals: number; //  3;
  sourceDescription: string; //  "U.S. Dept. of Labor, Bureau of Labor Statistics";
  sourceLink: string; //  "https: string; // //www.bls.gov/";
  source_description: string; //  "U.S. Dept. of Labor, Bureau of Labor Statistics";
  source_link: string; //  "https://www.bls.gov/";
}

export interface Observations {
  observationStart: string; // "1913-01-01";
  observationEnd: string; // "2024-12-01";
  orderBy: string; // "";
  sortOrder: string; // "";
  transformationResults: {
    transformation: Transformations;
    dates: string[]; // "2024-12-01"
    values: string[]; // data points
    pseudoHistory: boolean[]; // unsure what this is
  }[];
}

type Transformations =
  | Levels
  | YOYPercentChange
  | YTDPercentChange
  | C5MAPercentChange
  | MOMPercentChange
  | YOYChange
  | YTDChange
  | C5MAChange
  | MOMChange;

type Levels = "lvl";
type YOYPercentChange = "pc1";
type YTDPercentChange = "ytdpc1";
type C5MAPercentChange = "c5mapc1";
type MOMPercentChange = "mompc1";
type YOYChange = "ch1";
type YTDChange = "ytdch1";
type C5MAChange = "c5mach1";
type MOMChange = "momch1";

type SeasonalAdjustment =
  | "seasonally_adjusted"
  | "not_seasonally_adjusted"
  | "not_applicable";
