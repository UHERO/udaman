class AddUnitsLabelToSeries < ActiveRecord::Migration
  def change
    add_column :series, :unitsLabel, :string
  end
end
