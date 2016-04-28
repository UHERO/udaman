class AddInitialIndices < ActiveRecord::Migration
  def self.up
    add_index(:series, :name) unless index_exists? :series, :name
    add_index(:aremos_series, :name) unless index_exists? :aremos_series, :name
    add_index(:data_points, :series_id) unless index_exists? :data_points, :series_id
    add_index(:data_sources, :series_id) unless index_exists? :data_sources, :series_id
#    add_index(:data_points, :series_id)
    add_index(:data_points, [:series_id, :date_string]) unless index_exists? :data_points, [:series_id, :date_string]
  end

  def self.down
    remove_index(:series, :name) if index_exists? :series, :name
    remove_index(:aremos_series, :name) if index_exists? :aremos_series, :name
    remove_index(:data_points, :series_id) if index_exists? :data_points, :series_id
    remove_index(:data_sources, :series_id) if index_exists? :data_sources, :series_id
#    remove_index(:data_points, :series_id)
    remove_index(:data_points, [:series_id, :date_string]) if index_exists? :data_points, [:series_id, :date_string]
  end
end

