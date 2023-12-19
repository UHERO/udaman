class ChangeDecimalsBothMeasurementAndSeries < ActiveRecord::Migration[5.2]
  def change
    change_column_default :measurements, :decimals, 1
    change_column_default :series, :decimals, 1
  end
end
