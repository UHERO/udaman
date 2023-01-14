class MoveUnitsToLoader < ActiveRecord::Migration[5.2]
  def change
    add_column :data_sources, :div_by, :float, null: false, default: false, after: :role
  end
end
