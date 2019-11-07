class PostUnivSplitCleanup < ActiveRecord::Migration[5.2]
  def change
    remove_column :series,  :frequency_ob
    remove_column :series,  :seasonally_adjusted_ob
    remove_column :series,  :seasonal_adjustment_ob
    remove_column :series,  :last_demetra_datestring_ob
    remove_column :series,  :factors_ob
    remove_column :series,  :factor_application_ob
    remove_column :series,  :aremos_missing_ob
    remove_column :series,  :aremos_diff_ob
    remove_column :series,  :mult_ob
    remove_column :series,  :last_demetra_date_ob
    remove_column :series,  :units_ob
    remove_column :series,  :percent_ob
    remove_column :series,  :real_ob
    remove_column :series,  :frequency_transform_ob
    remove_column :series,  :restricted_ob
    remove_column :series,  :quarantined_ob
    remove_column :series,  :base_year_ob
    remove_column :series,  :measurement_id

    change_column :series, :dataPortalName, :string, after: :name

    remove_column :series,  :unitsLabel
    remove_column :series,  :unitsLabelShort
    remove_column :measurements,  :units_label
    remove_column :measurements,  :units_label_short

    remove_column :data_lists, :startdate
    remove_column :data_lists, :enddate

    remove_column :xseries, :decimals_ob
    remove_column :data_points, :series_id_ob
    remove_column :geographies, :subregion
    remove_column :geographies, :incgrp2015

    change_column :series, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :measurements, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'
    change_column :feature_toggles, :universe, %q(ENUM('UHERO','DBEDT','NTA','COH')), null: false, default: 'UHERO'

    drop_table :category_geographies
    drop_table :category_frequencies
  end
end
