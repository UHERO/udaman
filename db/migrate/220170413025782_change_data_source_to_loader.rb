class ChangeDataSourceToLoader < ActiveRecord::Migration[5.2]
  def self.up
    rename_table :data_sources, :loaders
    rename_table :data_source_actions, :loader_actions
    rename_table :data_source_downloads, :loader_downloads
  end

  def self.down
    rename_table :loaders, :data_sources
    rename_table :loader_actions, :data_source_actions
    rename_table :loader_downloads, :data_source_downloads
  end
end
