class PostUnivSplitCleanup < ActiveRecord::Migration[5.2]
  def change
    remove_column :xseries, :decimals_ob
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
  end
end
