class MoveUnitsToLoader < ActiveRecord::Migration[5.2]
  def change
    add_column :data_sources, :scale, :float, null: false, default: 1, after: :priority
  end
end
