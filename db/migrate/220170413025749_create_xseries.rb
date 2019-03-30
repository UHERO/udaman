class CreateXseries < ActiveRecord::Migration[5.2]
  def self.up
    execute <<-SQL
      CREATE TABLE xseries LIKE series;
    SQL
    execute <<-SQL
      INSERT xseries SELECT * FROM series;
    SQL

    add_column :series, :xseries_id, :integer, null: false, after: :universe
    execute <<-SQL
      UPDATE series SET xseries_id = id;
    SQL
    add_foreign_key :series, :xseries

    add_column :data_points, :xseries_id, :integer, null: false, after: :series_id
    execute <<-SQL
      UPDATE data_points SET xseries_id = series_id;
    SQL

    add_column :public_data_points, :xseries_id, :integer, null: false, after: :series_id
    execute <<-SQL
      UPDATE public_data_points SET xseries_id = series_id;
    SQL

    add_column :xseries, :primary_series_id, :integer, after: :id
    execute <<-SQL
      UPDATE xseries SET primary_series_id = id;
    SQL
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
    remove_column :xseries, :dependency_depth
    remove_column :xseries, :investigation_notes
    remove_column :xseries, :scratch

    ## recreate foreign key indexes so names differ from :series table
    remove_foreign_key :xseries, :sources if foreign_key_exists? :xseries, :sources
    add_foreign_key :xseries, :sources
    remove_foreign_key :xseries, :source_details if foreign_key_exists? :xseries, :source_details
    add_foreign_key :xseries, :source_details

    # cleanup
    remove_column :data_points, :id       if column_exists? :data_points, :id
    remove_column :data_points, :universe if column_exists? :data_points, :universe
    remove_column :public_data_points, :universe if column_exists? :public_data_points, :universe
    drop_table :sidekiq_failures if table_exists? :sidekiq_failures
    change_column :data_points, :date, :date, after: :xseries_id
    change_column :xseries, :quarantined, :boolean, after: :restricted
    change_column :xseries, :last_demetra_date, :date, after: :last_demetra_datestring
    change_column :xseries, :base_year, :integer, after: :decimals
  end

  def self.down
    if column_exists? :series, :xseries_id
      remove_foreign_key :series, :xseries
      remove_column :series, :xseries_id
    end
    remove_column :data_points, :xseries_id        if column_exists? :data_points, :xseries_id
    remove_column :public_data_points, :xseries_id if column_exists? :public_data_points, :xseries_id
    drop_table :xseries if table_exists? :xseries
  end
end
