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
    execute <<~SQL
      UPDATE series SET xseries_id = id;
    SQL
    change_column_null :series, :xseries_id, false

    add_column :data_points, :xseries_id, :integer, after: :series_id
    add_foreign_key :data_points, :xseries
    execute <<~SQL
      UPDATE data_points SET xseries_id = series_id;
    SQL
    change_column_null :data_points, :xseries_id, false

    add_column :public_data_points, :xseries_id, :integer, after: :series_id
    add_foreign_key :public_data_points, :xseries
    execute <<~SQL
      UPDATE public_data_points SET xseries_id = series_id;
    SQL
    change_column_null :public_data_points, :xseries_id, false

    add_column :xseries, :primary_series_id, :integer, after: :id
    add_foreign_key :xseries, :series, column: :primary_series_id
    execute <<~SQL
      UPDATE xseries SET primary_series_id = id;
    SQL
    change_column_null :xseries, :primary_series_id, false

    remove_column :xseries, :universe
    remove_column :xseries, :name
    remove_column :xseries, :description
    remove_column :xseries, :dataPortalName
    remove_column :xseries, :unit_id
    remove_column :xseries, :geography_id
    remove_column :xseries, :unitsLabelShort
    remove_column :xseries, :unitsLabel
    remove_column :xseries, :measurement_id
    remove_column :xseries, :dependency_depth
    remove_column :xseries, :investigation_notes
    remove_column :xseries, :scratch

    # cleanup
    remove_column :data_points, :id       if column_exists? :data_points, :id
    remove_column :data_points, :universe if column_exists? :data_points, :universe
    change_column :data_points, :date, :date, after: :xseries_id
    change_column :xseries, :quarantined, :boolean, after: :restricted
    change_column :xseries, :last_demetra_date, :date, after: :last_demetra_datestring
  end

  def self.down
    remove_column :series, :xseries_id      if column_exists? :series, :xseries_id
    remove_column :data_points, :xseries_id if column_exists? :data_points, :xseries_id
    remove_column :public_data_points, :xseries_id if column_exists? :public_data_points, :xseries_id
    drop_table :xseries if table_exists? :xseries
  end
end
