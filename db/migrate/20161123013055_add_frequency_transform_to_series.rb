class AddFrequencyTransformToSeries < ActiveRecord::Migration
  def change
    add_column :series, :frequency_transform, :string
  end
end
