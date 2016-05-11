class DropOriginalLastRun < ActiveRecord::Migration
  def self.up
    remove_column :data_sources, :last_run if column_exists? :data_sources, :last_run
  end

  def self.down
    add_column :data_sources, :last_run, :datetime unless column_exists? :data_sources, :last_run
  end
end
