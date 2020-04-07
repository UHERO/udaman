class CreateMeasurementSeries < ActiveRecord::Migration
  def change
    create_table :measurement_series do |t|
      t.belongs_to :measurement, index: true
      t.belongs_to :series, index: true
    end
    add_index :measurement_series, [:measurement_id, :series_id], unique: true
  end
end
