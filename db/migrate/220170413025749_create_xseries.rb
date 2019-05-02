class CreateXseries < ActiveRecord::Migration[5.2]
  def self.up
    execute <<~MYSQL
      CREATE TABLE xseries LIKE series;
    MYSQL
    execute <<~MYSQL
      INSERT xseries SELECT * FROM series;
    MYSQL

    add_column :series, :xseries_id, :integer, null: false, after: :universe
    execute <<~MYSQL
      UPDATE series SET xseries_id = id;
    MYSQL
    add_foreign_key :series, :xseries
    add_index :series, [:universe, :xseries_id], unique: true

    add_column :data_points, :xseries_id, :integer, null: false, after: :series_id
    execute <<~MYSQL
      UPDATE data_points SET xseries_id = series_id;
    MYSQL
    execute <<~MYSQL
      alter table `data_points` drop primary key
    MYSQL
    execute <<~MYSQL
      alter table `data_points` add primary key (xseries_id, `date`, created_at, data_source_id)
    MYSQL
    # add_foreign_key :data_points, :xseries

    add_column :xseries, :primary_series_id, :integer, after: :id
    execute <<~MYSQL
      UPDATE xseries SET primary_series_id = id;
    MYSQL
    add_foreign_key :xseries, :series, column: :primary_series_id

    remove_column :xseries, :universe
    remove_column :xseries, :name
    remove_column :xseries, :description
    remove_column :xseries, :dataPortalName
    remove_column :xseries, :unit_id
    remove_column :xseries, :geography_id
    remove_column :xseries, :source_id
    remove_column :xseries, :source_link
    remove_column :xseries, :source_detail_id
    remove_column :xseries, :unitsLabelShort
    remove_column :xseries, :unitsLabel
    remove_column :xseries, :measurement_id
    remove_column :xseries, :dependency_depth
    remove_column :xseries, :investigation_notes
    remove_column :xseries, :scratch

    rename_column :series, :frequency, :frequency_ob if column_exists? :series, :frequency
    rename_column :series, :seasonally_adjusted, :seasonally_adjusted_ob if column_exists? :series, :seasonally_adjusted
    rename_column :series, :seasonal_adjustment, :seasonal_adjustment_ob if column_exists? :series, :seasonal_adjustment
    rename_column :series, :last_demetra_date, :last_demetra_date_ob if column_exists? :series, :last_demetra_date
    rename_column :series, :last_demetra_datestring, :last_demetra_datestring_ob if column_exists? :series, :last_demetra_datestring
    rename_column :series, :factors, :factors_ob if column_exists? :series, :factors
    rename_column :series, :factor_application, :factor_application_ob if column_exists? :series, :factor_application
    rename_column :series, :aremos_diff, :aremos_diff_ob if column_exists? :series, :aremos_diff
    rename_column :series, :aremos_missing, :aremos_missing_ob if column_exists? :series, :aremos_missing
    rename_column :series, :mult, :mult_ob if column_exists? :series, :mult
    rename_column :series, :units, :units_ob if column_exists? :series, :units
    rename_column :series, :percent, :percent_ob if column_exists? :series, :percent
    rename_column :series, :real, :real_ob if column_exists? :series, :real
    rename_column :series, :decimals, :decimals_ob if column_exists? :series, :decimals
    rename_column :series, :frequency_transform, :frequency_transform_ob if column_exists? :series, :frequency_transform
    rename_column :series, :restricted, :restricted_ob if column_exists? :series, :restricted
    rename_column :series, :quarantined, :quarantined_ob if column_exists? :series, :quarantined
    rename_column :series, :base_year, :base_year_ob if column_exists? :series, :base_year

    # cleanup
    remove_column :data_points, :id       if column_exists? :data_points, :id
    remove_column :data_points, :universe if column_exists? :data_points, :universe
    rename_column :public_data_points, :universe, :universe_ob if column_exists? :public_data_points, :universe
    drop_table :sidekiq_failures if table_exists? :sidekiq_failures
    change_column :data_points, :current, :boolean, after: :xseries_id
    change_column :data_points, :date, :date, after: :xseries_id
    change_column :xseries, :quarantined, :boolean, after: :restricted
    change_column :xseries, :last_demetra_date, :date, after: :last_demetra_datestring
    change_column :xseries, :base_year, :integer, after: :decimals

    execute <<~MYSQL
      create view `series_v` as
      select s.*,
      x.frequency,
      x.seasonally_adjusted,
      x.seasonal_adjustment,
      x.units,
      x.percent,
      x.`real`,
      x.decimals,
      x.last_demetra_datestring,
      x.last_demetra_date,
      x.factors,
      x.factor_application,
      x.aremos_missing,
      x.aremos_diff,
      x.mult,
      x.base_year,
      x.frequency_transform,
      x.restricted,
      x.quarantined
      from series s join xseries x on x.id = s.xseries_id
    MYSQL
  end

  def self.down
    if column_exists? :series, :xseries_id
      remove_index :series, column: [:universe, :xseries_id]
      remove_foreign_key :series, :xseries
      remove_column :series, :xseries_id
    end
    execute <<~MYSQL
      alter table `data_points` drop primary key
    MYSQL
    execute <<~MYSQL
      alter table `data_points` add primary key (series_id, `date`, created_at, data_source_id)
    MYSQL
    remove_column :data_points, :xseries_id if column_exists? :data_points, :xseries_id
    drop_table :xseries if table_exists? :xseries

    rename_column :series, :frequency_ob, :frequency if column_exists? :series, :frequency_ob
    rename_column :series, :seasonally_adjusted_ob, :seasonally_adjusted if column_exists? :series, :seasonally_adjusted_ob
    rename_column :series, :seasonal_adjustment_ob, :seasonal_adjustment if column_exists? :series, :seasonal_adjustment_ob
    rename_column :series, :last_demetra_date_ob, :last_demetra_date if column_exists? :series, :last_demetra_date_ob
    rename_column :series, :last_demetra_datestring_ob, :last_demetra_datestring if column_exists? :series, :last_demetra_datestring_ob
    rename_column :series, :factors_ob, :factors if column_exists? :series, :factors_ob
    rename_column :series, :factor_application_ob, :factor_application if column_exists? :series, :factor_application_ob
    rename_column :series, :aremos_diff_ob, :aremos_diff if column_exists? :series, :aremos_diff_ob
    rename_column :series, :aremos_missing_ob, :aremos_missing if column_exists? :series, :aremos_missing_ob
    rename_column :series, :mult_ob, :mult if column_exists? :series, :mult_ob
    rename_column :series, :units_ob, :units if column_exists? :series, :units_ob
    rename_column :series, :percent_ob, :percent if column_exists? :series, :percent_ob
    rename_column :series, :real_ob, :real if column_exists? :series, :real_ob
    rename_column :series, :decimals_ob, :decimals if column_exists? :series, :decimals_ob
    rename_column :series, :frequency_transform_ob, :frequency_transform if column_exists? :series, :frequency_transform_ob
    rename_column :series, :restricted_ob, :restricted if column_exists? :series, :restricted_ob
    rename_column :series, :quarantined_ob, :quarantined if column_exists? :series, :quarantined_ob
    rename_column :series, :base_year_ob, :base_year if column_exists? :series, :base_year_ob
    rename_column :public_data_points, :universe_ob, :universe if column_exists? :public_data_points, :universe_ob

    execute <<~MYSQL
      drop view `series_v`
    MYSQL
  end
end
