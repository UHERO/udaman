class ChangeCategoriesDefaultGeoFreq < ActiveRecord::Migration
  def self.up
    change_column :categories, :default_freq, "ENUM('A','S','Q','M','W','D')"
    add_column :categories, :default_geo_id, :integer, after: :ancestry
    add_foreign_key :categories, :geographies, column: :default_geo_id
  end
  def self.down
    change_column :categories, :default_freq, :string
    remove_column :categories, :default_geo_id
  end
end
