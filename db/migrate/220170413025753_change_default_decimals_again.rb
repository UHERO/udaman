class ChangeDefaultDecimalsAgain < ActiveRecord::Migration[5.2]
  def self.up
    change_column_default :measurements, :decimals, 2
    change_column_null :measurements, :decimals, false
    change_column_default :xseries, :decimals, 2
    change_column_null :xseries, :decimals, false
    change_column_default :series, :decimals_ob, 2
    change_column_null :series, :decimals_ob, false
    execute <<~MYSQL
      update series s join xseries x on x.id = s.xseries_id
      set s.decimals_ob = x.decimals
    MYSQL
    rename_column :xseries, :decimals, :decimals_ob if column_exists? :xseries, :decimals
    rename_column :series, :decimals_ob, :decimals if column_exists? :series, :decimals_ob

    ## Redefine series_v view
    execute <<~MYSQL
      create or replace view `series_v` as
      select series.*,
      x.frequency,
      x.seasonally_adjusted,
      x.seasonal_adjustment,
      x.units,
      x.percent,
      x.real,
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
      x.quarantined,
      x.primary_series_id,
      x.created_at as xs_created_at,
      x.updated_at as xs_updated_at
      from series join xseries x on x.id = series.xseries_id
    MYSQL
  end

  def self.down
    rename_column :xseries, :decimals_ob, :decimals if column_exists? :xseries, :decimals_ob
    rename_column :series, :decimals, :decimals_ob if column_exists? :series, :decimals

    execute <<~MYSQL
      create or replace view `series_v` as
      select series.*,
      x.frequency,
      x.seasonally_adjusted,
      x.seasonal_adjustment,
      x.units,
      x.percent,
      x.real,
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
      x.quarantined,
      x.primary_series_id,
      x.created_at as xs_created_at,
      x.updated_at as xs_updated_at
      from series join xseries x on x.id = series.xseries_id
    MYSQL
  end
end
