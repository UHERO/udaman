class CreateSeriesx < ActiveRecord::Migration[5.2]
  def self.up
    execute <<~SQL
      CREATE TABLE seriesx LIKE series;
    SQL
    add_reference :series, :seriesx, foreign_key: true, null: false, default: 0, after: :universe
#   add_foreign_key :series, :seriesx, column: :seriesx_id
    add_reference :data_points, :seriesx, foreign_key: true, null: false, default: 0, after: :series_id
#   add_foreign_key :data_points, :seriesx, column: :seriesx_id
    add_reference :public_data_points, :seriesx, foreign_key: true, null: false, default: 0, after: :series_id
#   add_foreign_key :public_data_points, :seriesx, column: :seriesx_id

    add_reference :seriesx, :series, foreign_key: true, null: false, default: 0, after: :id
    rename_column :seriesx, :series_id, :primary_series_id
#    add_column :seriesx, :id, :integer, first: true ### can we populate with auto increment?
    remove_column :seriesx, :universe
    remove_column :seriesx, :name
    remove_column :seriesx, :description
    remove_column :seriesx, :dataPortalName
    remove_column :seriesx, :unit_id
    remove_column :seriesx, :geography_id
    remove_column :seriesx, :unitsLabelShort
    remove_column :seriesx, :unitsLabel
    remove_column :seriesx, :measurement_id
    remove_column :seriesx, :scratch

    # cleanup
    remove_column :data_points, :id
    remove_column :data_points, :universe
  end

  def self.down
    drop_table :seriesx if table_exists? :seriesx
    remove_column :series, :seriesx_id if column_exists? :series, :seriesx_id
    remove_column :data_points, :seriesx_id if column_exists? :data_points, :seriesx_id
    remove_column :public_data_points, :seriesx_id if column_exists? :public_data_points, :seriesx_id
  end
end
