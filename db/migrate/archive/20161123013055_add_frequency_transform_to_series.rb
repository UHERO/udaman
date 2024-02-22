class AddFrequencyTransformToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :frequency_transform, :string
  end
end
