class MoveUnitsToLoader < ActiveRecord::Migration[5.2]
  def self.up
    add_column :data_sources, :scale, :string, null: false, default: '1.0', after: :priority
  end
  def self.down
    remove_column :data_sources, :scale
  end
end
