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
export {};
