class AddSeriesPropertiesToMeasurements < ActiveRecord::Migration
  def change
    add_reference :measurements, :source_detail, foreign_key: true
    add_reference :measurements, :source, foreign_key: true
    add_column :measurements, :source_link, :string
  end
end
