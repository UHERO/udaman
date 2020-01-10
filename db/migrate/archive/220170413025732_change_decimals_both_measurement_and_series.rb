class ChangeDecimalsBothMeasurementAndSeries < ActiveRecord::Migration
  def change
    change_column_default :measurements, :decimals, 1
    change_column_default :series, :decimals, 1
  end
end
