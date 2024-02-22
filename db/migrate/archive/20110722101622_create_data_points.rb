class CreateDataPoints < ActiveRecord::Migration[5.2]
  def self.up
    create_table :data_points unless table_exists? :data_points do |t|
      t.integer :series_id
      t.string :date_string
      t.float :value
      t.boolean :current
      t.integer :data_source_id
      t.datetime :history

      t.timestamps
    end
  end

  def self.down
    drop_table :data_points if table_exists? :data_points
  end
end
