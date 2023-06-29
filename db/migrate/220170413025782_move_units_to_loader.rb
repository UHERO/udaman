class MoveUnitsToLoader < ActiveRecord::Migration[5.2]
#
##
#
##  RENUMBER THIS MIGRATION IF NEEDED, DEPENDING ON RELEASE ORDER
#
##
#
  def change
    add_column :data_sources, :scale, :float, null: false, default: 1, after: :priority
  end
end
