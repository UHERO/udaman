class AddLastRunMilliseconds < ActiveRecord::Migration
  def self.up
    add_column :data_sources, :last_run_in_seconds, :decimal, :precision => 17, :scale => 3 unless column_exists? :data_sources, :last_run_in_seconds
  end

  def self.down
    remove_column :data_sources, :last_run_in_seconds if column_exists? :data_sources, :last_run_in_seconds
  end
end
