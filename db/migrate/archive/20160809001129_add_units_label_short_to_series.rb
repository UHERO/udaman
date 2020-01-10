class AddUnitsLabelShortToSeries < ActiveRecord::Migration
  def change
    add_column :series, :unitsLabelShort, :string
  end
end
