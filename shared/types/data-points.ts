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

export interface DataPoint {
  xseries_id: number;
  date: string; // "yyyy-MM-dd"
  created_at: Date;
  data_source_id: number;
  current: 0 | 1;
  value: number;
  pseudo_history: number;
  history: Date;
  updated_at: Date;
  change: number;
  yoy: number;
  ytd: number;
}
