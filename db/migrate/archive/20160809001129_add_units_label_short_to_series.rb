class AddUnitsLabelShortToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :unitsLabelShort, :string
  end
end
