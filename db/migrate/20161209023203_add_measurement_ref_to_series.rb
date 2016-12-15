class AddMeasurementRefToSeries < ActiveRecord::Migration
  def change
    add_reference :series, :measurement, foreign_key: true
  end
end
