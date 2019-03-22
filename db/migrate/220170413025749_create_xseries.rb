class CreateXseries < ActiveRecord::Migration[5.2]
  def self.up
    execute <<~SQL
      CREATE TABLE xseries LIKE series;
    SQL
    execute <<~SQL
      INSERT xseries SELECT * FROM series;
    SQL

    add_column :series, :xseries_id, :integer, null: false, after: :universe
    execute <<~SQL
      UPDATE series SET xseries_id = id;
    SQL
    add_foreign_key :series, :xseries

    add_column :data_points, :xseries_id, :integer, null: false, after: :series_id
    execute <<~SQL
      UPDATE data_points SET xseries_id = series_id;
    SQL
    execute <<-SQL
      ALTER TABLE data_points DROP PRIMARY KEY, ADD PRIMARY KEY(`xseries_id`, `date`, `created_at`, `data_source_id`);
    SQL

    add_column :public_data_points, :xseries_id, :integer, null: false, after: :series_id
    execute <<~SQL
      UPDATE public_data_points SET xseries_id = series_id;
    SQL
    execute <<-SQL
      ALTER TABLE public_data_points DROP PRIMARY KEY, ADD PRIMARY KEY(`xseries_id`, `date`);
    SQL

    add_column :xseries, :primary_series_id, :integer, null: false, after: :id
    execute <<~SQL
      UPDATE xseries SET primary_series_id = id;
    SQL
    add_foreign_key :xseries, :series, column: :primary_series_id

    ## recreate foreign key indexes so they differ from :series table
    remove_foreign_key :xseries, :source
    add_foreign_key :xseries, :source
    remove_foreign_key :xseries, :source_detail
    add_foreign_key :xseries, :source_detail

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
    change_column :xseries, :base_year, :integer, after: :decimals
  end

  def self.down
    remove_column :series, :xseries_id      if column_exists? :series, :xseries_id
    remove_column :data_points, :xseries_id if column_exists? :data_points, :xseries_id
    remove_column :public_data_points, :xseries_id if column_exists? :public_data_points, :xseries_id
    drop_table :xseries if table_exists? :xseries
  end
end
