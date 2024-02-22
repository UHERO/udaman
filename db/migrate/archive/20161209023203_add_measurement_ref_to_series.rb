class AddMeasurementRefToSeries < ActiveRecord::Migration[5.2]
  def change
    add_reference :series, :measurement, foreign_key: true
  end
end
