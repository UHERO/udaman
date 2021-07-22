class PerformanceColumnMoves < ActiveRecord::Migration[5.2]
  def change
    change_column :series, :xseries_id, :integer, after: :id
    change_column :series, :unit_id, :integer, after: :geography_id
    change_column :series, :source_id, :integer, after: :unit_id
    change_column :series, :source_detail_id, :integer, after: :source_id
    add_column :series, :new_descrip, :string, limit: 500, after: :description
    add_column :series, :new_notes, :string, limit: 500, after: :source_link

    change_column :data_points, :data_source_id, :integer, after: :date
    change_column :data_points, :created_at, :integer, after: :date
    change_column :data_points, :pseudo_history, :integer, after: :value

    change_column :categories, :default_geo_id, :integer, after: :id
    change_column :categories, :data_list_id, :integer, after: :id
    change_column :categories, :name, :string, after: :order

    remove_column :data_lists, :list

    change_column :data_sources, :disabled, :boolean, after: :series_id
    change_column :data_sources, :color, :string, after: :presave_hook
    add_column :data_sources, :new_eval, :string, limit: 500, after: :clear_before_load
    change_column :data_sources, :description, :string, after: :last_error_at
    change_column :data_sources, :dependencies, :string, after: :last_error_at

    change_column :measurements, :source_detail_id, :integer, after: :id
    change_column :measurements, :source_id, :integer, after: :id
    change_column :measurements, :unit_id, :integer, after: :id
    add_column :measurements, :new_notes, :string, limit: 500, after: :notes
  end
end
