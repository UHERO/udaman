class RemoveDataField < ActiveRecord::Migration
  def self.up
    remove_column :series, :data if column_exists? :series, :data
    remove_column :data_sources, :data if column_exists? :data_sources, :data
  end

  def self.down
    add_column :series, :data, :text, :limit => 4294967295 unless column_exists? :series, :data
    add_column :data_sources, :data, :text, :limit => 4294967295 unless column_exists? :data_sources, :data
  end
end
