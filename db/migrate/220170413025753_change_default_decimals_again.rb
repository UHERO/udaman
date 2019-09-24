class ChangeDefaultDecimalsAgain < ActiveRecord::Migration[5.2]
  def self.up
    change_column_default :measurements, :decimals, 2
    change_column_null :measurements, :decimals, false
    change_column_default :xseries, :decimals, 2
    change_column_null :xseries, :decimals, false
    change_column_default :series, :decimals_ob, 2
    change_column_null :series, :decimals_ob, false
    ## copy data between tables
    rename_column :xseries, :decimals, :decimals_ob
    rename_column :series, :decimals_ob, :decimals
  end
  def self.down
    rename_column :xseries, :decimals_ob, :decimals if column_exists? :xseries, :decimals_ob
    rename_column :series, :decimals, :decimals_ob if column_exists? :series, :decimals
  end
end
