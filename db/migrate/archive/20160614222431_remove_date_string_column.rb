class RemoveDateStringColumn < ActiveRecord::Migration[5.2]
  def change
    remove_index(:data_points, [:series_id, :date_string]) if index_exists? :data_points, [:series_id, :date_string]
    remove_column :data_points, :date_string
  end
end
