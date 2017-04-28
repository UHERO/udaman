class AddDefaultValueToSeriesUnits < ActiveRecord::Migration
  def change
    change_column :series, :units, :integer, null: false, default: 1, after: :unit_id
  end
end
