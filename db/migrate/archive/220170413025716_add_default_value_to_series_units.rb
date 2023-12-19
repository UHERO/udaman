class AddDefaultValueToSeriesUnits < ActiveRecord::Migration[5.2]
  def change
    change_column :series, :units, :integer, null: false, default: 1, after: :unit_id
  end
end
