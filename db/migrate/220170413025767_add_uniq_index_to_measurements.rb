class AddUniqIndexToMeasurements < ActiveRecord::Migration[5.2]
  def self.up
    add_index :measurements, [:universe, :prefix], unique: true unless index_exists? :measurements, [:universe, :prefix]
  end

  def self.down
    remove_index :measurements, [:universe, :prefix], unique: true if index_exists? :measurements, [:universe, :prefix]
  end
end
