export type Module = "trend" | "char" | "airseat" | "exp" | "hotel";

export type ModuleDimension = {
  module: string;
  handle: string;
  nameW: string;
  level: number;
  order: number;
  children?: ModuleDimension[];
  state: boolean;
  parent?: string | undefined;
};

export type Dimension = {
  [key: string]: ModuleDimension[];
};

export type SelectedDimension = {
  [key: string]: Record<string, ModuleDimension>;
};

export type DvwSeries = {
  frequency?: string;
  module?: string;
  observationEnd?: string;
  observationStart?: string;
  series: DvwModuleSeries[] | [];
};

export type DvwModuleSeries = {
  Categories?: string;
  Indicators?: string;
  Destinations?: string;
  Markets?: string;
  Groups?: string;
  columns: string[];
  dates: string[];
  dimensions?: Dimension;
  dimensionArr: string[];
  observationEnd: string;
  observationStart: string;
  observations: Record<string, string>;
  order: string;
  units: string;
  values: number[];
  decimal: number;
  state?: boolean;
};
