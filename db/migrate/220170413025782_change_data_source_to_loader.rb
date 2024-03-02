class ChangeDataSourceToLoader < ActiveRecord::Migration[5.2]
  def self.up
    rename_table :data_sources, :loaders if table_exists? :data_sources
    rename_column :data_source_actions, :data_source_id, :loader_id if column_exists? :data_source_actions, :data_source_id
    rename_table :data_source_actions, :loader_actions if table_exists? :data_source_actions
    rename_column :data_source_downloads, :data_source_id, :loader_id if column_exists? :data_source_downloads, :data_source_id
    rename_table :data_source_downloads, :loader_downloads if table_exists? :data_source_downloads

    rename_column :data_points, :data_source_id, :loader_id if column_exists? :data_points, :data_source_id
  end

  def self.down
    rename_table :loaders, :data_sources if table_exists? :loaders
    rename_column :loader_actions, :loader_id, :data_source_id if column_exists? :loader_actions, :loader_id
    rename_table :loader_actions, :data_source_actions if table_exists? :loader_actions
    rename_column :loader_downloads, :loader_id, :data_source_id if column_exists? :loader_downloads, :loader_id
    rename_table :loader_downloads, :data_source_downloads if table_exists? :loader_downloads

    rename_column :data_points, :loader_id, :data_source_id if column_exists? :data_points, :loader_id
  end
end
