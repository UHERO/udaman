class CreateXseries < ActiveRecord::Migration[5.2]
  def self.up
    execute <<~SQL
      CREATE TABLE xseries LIKE series;
    SQL
    execute <<~SQL
      INSERT xseries SELECT * FROM series;
    SQL
    add_column :series, :xseries_id, :integer, after: :universe
    add_foreign_key :series, :xseries
    add_column :data_points, :xseries_id, :integer, after: :series_id
    add_foreign_key :data_points, :xseries
    add_column :public_data_points, :xseries_id, :integer, after: :series_id
    add_foreign_key :public_data_points, :xseries

    add_column :xseries, :primary_series_id, :integer, after: :id
    add_foreign_key :xseries, :series, column: :primary_series_id
    remove_column :xseries, :universe
    remove_column :xseries, :name
    remove_column :xseries, :description
    remove_column :xseries, :dataPortalName
    remove_column :xseries, :unit_id
    remove_column :xseries, :geography_id
    remove_column :xseries, :unitsLabelShort
    remove_column :xseries, :unitsLabel
    remove_column :xseries, :measurement_id
    remove_column :xseries, :scratch

    # cleanup
    remove_column :data_points, :id
    remove_column :data_points, :universe
    change_column :data_points, :date, :date, after: :series_id
  end

  def self.down
    drop_table :xseries if table_exists? :xseries
    remove_column :series, :xseries_id if column_exists? :series, :xseries_id
    remove_column :data_points, :xseries_id if column_exists? :data_points, :xseries_id
    remove_column :public_data_points, :xseries_id if column_exists? :public_data_points, :xseries_id
  end
end
