class CreateDataSources < ActiveRecord::Migration[5.2]
  def self.up
    create_table :data_sources unless table_exists? :data_sources do |t|
      t.integer :series_id
      t.string :description
      t.string :eval
      t.text :data, :limit => 4294967295
      t.datetime :last_run
      t.text :dependencies
      t.string :color
      t.float :runtime

      t.timestamps
    end
  end

  def self.down
    drop_table :data_sources if table_exists? :data_sources
  end
end
