import { Universe } from "./shared";

// +-------------+------------------------------------------+------+-----+---------+----------------+
// | Field       | Type                                     | Null | Key | Default | Extra          |
// +-------------+------------------------------------------+------+-----+---------+----------------+
// | id          | int(11)                                  | NO   | PRI | NULL    | auto_increment |
// | universe    | enum('UHERO','DBEDT','NTA','COH','CCOM') | NO   | MUL | UHERO   |                |
// | description | varchar(255)                             | YES  |     | NULL    |                |
// | link        | varchar(255)                             | YES  |     | NULL    |                |
// | created_at  | datetime                                 | NO   |     | NULL    |                |
// | updated_at  | datetime                                 | NO   |     | NULL    |                |
// +-------------+------------------------------------------+------+-----+---------+----------------+

export interface Source {
  id: number;
  universe: Universe;
  description: string | null;
  link: string | null;
  created_at: Date;
  updated_at: Date;
}
