class AddUnitsLabelToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :unitsLabel, :string
  end
end
