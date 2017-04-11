class AddUnitsModelToSeriesMeasurements < ActiveRecord::Migration
  def change
    add_reference :series, :unit, foreign_key: true, after: :unitsLabelShort
    add_reference :measurements, :unit, foreign_key: true, after: :units_label_short
  end
end
