class ChangeDefaultDecimalsAgain < ActiveRecord::Migration[5.2]
  def self.up
    change_column_default :measurements, :decimals, 1
    change_column_default :series, :decimals, 1
  end

  def self.down
    change_column_default :measurements, :decimals, 2
    change_column_default :series, :decimals, 2
  end
end
