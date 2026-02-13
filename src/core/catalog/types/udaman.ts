import { SeasonalAdjustment } from "./shared";

export interface Series {
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

export interface XSeries {
  id: number;
  primary_series_id: number;
  restricted: number;
  quarantined: number;
  frequency: string; // "quarter" | "month" | "year"
  seasonally_adjusted: null;
  seasonal_adjustment: SeasonalAdjustment;
  aremos_missing: number;
  aremos_diff: null;
  mult: null;
  created_at: Date;
  updated_at: Date;
  units: number;
  percent: number;
  real: number;
  base_year: null;
  frequency_transform: string; // "average";
  last_demetra_date: null;
  last_demetra_datestring: null;
  factor_application: null;
  factors: null;
}

export interface SeriesSummary {
  name: string;
  id: number;
  seasonalAdjustment: SeasonalAdjustment;
  restricted: boolean;
  portalName: string | null;
  unitShortLabel: string | null;
  minDate: Date | null;
  maxDate: Date | null;
  sourceDescription: string | null;
  sourceUrl: string | null;
}

// Data Points Mariadb Schema
// +----------------+------------+------+-----+---------+-------+
// | Field          | Type       | Null | Key | Default | Extra |
// +----------------+------------+------+-----+---------+-------+
// | xseries_id     | int(11)    | NO   | PRI | NULL    |       |
// | date           | date       | NO   | PRI | NULL    |       |
// | created_at     | datetime   | NO   | PRI | NULL    |       |
// | data_source_id | int(11)    | NO   | PRI | NULL    |       |
// | current        | tinyint(1) | YES  |     | NULL    |       |
// | value          | double     | YES  |     | NULL    |       |
// | pseudo_history | int(11)    | YES  |     | 0       |       |
// | history        | datetime   | YES  |     | NULL    |       |
// | updated_at     | datetime   | YES  |     | NULL    |       |
// | change         | double     | YES  |     | NULL    |       |
// | yoy            | double     | YES  |     | NULL    |       |
// | ytd            | double     | YES  |     | NULL    |       |
// +----------------+------------+------+-----+---------+-------+

// Measurements Mariadb Schema
// +---------------------+------------------------------------------------------------------------+------+-----+---------+----------------+
// | Field               | Type                                                                   | Null | Key | Default | Extra          |
// +---------------------+------------------------------------------------------------------------+------+-----+---------+----------------+
// | id                  | int(11)                                                                | NO   | PRI | NULL    | auto_increment |
// | unit_id             | int(11)                                                                | YES  | MUL | NULL    |                |
// | source_id           | int(11)                                                                | YES  | MUL | NULL    |                |
// | source_detail_id    | int(11)                                                                | YES  | MUL | NULL    |                |
// | universe            | enum('UHERO','FC','DBEDT','NTA','COH','CCOM')                          | NO   | MUL | UHERO   |                |
// | prefix              | varchar(255)                                                           | NO   |     | NULL    |                |
// | data_portal_name    | varchar(255)                                                           | YES  |     | NULL    |                |
// | table_prefix        | varchar(255)                                                           | YES  |     | NULL    |                |
// | table_postfix       | varchar(255)                                                           | YES  |     | NULL    |                |
// | frequency_transform | varchar(255)                                                           | YES  |     | NULL    |                |
// | percent             | tinyint(1)                                                             | YES  |     | NULL    |                |
// | real                | tinyint(1)                                                             | YES  |     | NULL    |                |
// | decimals            | int(11)                                                                | NO   |     | 1       |                |
// | restricted          | tinyint(1)                                                             | NO   |     | 0       |                |
// | seasonally_adjusted | tinyint(1)                                                             | YES  |     | NULL    |                |
// | seasonal_adjustment | enum('seasonally_adjusted','not_seasonally_adjusted','not_applicable') | YES  |     | NULL    |                |
// | source_link         | varchar(255)                                                           | YES  |     | NULL    |                |
// | notes               | varchar(500)                                                           | YES  |     | NULL    |                |
// | created_at          | datetime                                                               | NO   |     | NULL    |                |
// | updated_at          | datetime                                                               | NO   |     | NULL    |                |
// +---------------------+------------------------------------------------------------------------+------+-----+---------+----------------+
