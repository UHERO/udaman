class CreateCompositeKeyForDataPoint < ActiveRecord::Migration
  def up
    execute <<-SQL
      DELETE FROM data_points WHERE `date` IS NULL;
    SQL
    
    change_column_null :data_points, :series_id, false
    change_column_null :data_points, :date, false
    change_column_null :data_points, :created_at, false
    change_column_null :data_points, :data_source_id, false

    remove_index(:data_points, :series_id) if index_exists? :data_points, :series_id

    execute <<-SQL
      ALTER TABLE data_points DROP PRIMARY KEY, ADD PRIMARY KEY(`series_id`, `date`, `created_at`, `data_source_id`);
    SQL
  end
  def down
    execute <<-SQL
      ALTER TABLE data_points DROP PRIMARY KEY, ADD PRIMARY KEY(id);
      ALTER TABLE data_points MODIFY id INT(11) NOT NULL AUTO_INCREMENT;
    SQL

    add_index(:data_points, :series_id) unless index_exists? :data_points, :series_id
    
    change_column_null :data_points, :series_id, true
    change_column_null :data_points, :date, true 
    change_column_null :data_points, :created_at, true
    change_column_null :data_points, :data_source_id, true
  end
end
