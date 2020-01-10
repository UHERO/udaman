class AddDataSourcePriority < ActiveRecord::Migration
  def self.up
    add_column :data_sources, :priority, :integer, :default => 100 unless column_exists? :data_sources, :priority
  end

  def self.down
    remove_column :data_sources, :priority if column_exists? :data_sources, :priority
  end
end
