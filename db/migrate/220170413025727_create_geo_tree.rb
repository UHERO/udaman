class CreateGeoTree < ActiveRecord::Migration
  def change
    create_table :geo_trees, id: false  do |t|
      t.integer :parent_id, null: false
      t.integer :child_id, null: false
    end
    add_foreign_key :geo_trees, :geographies, column: :parent_id
    add_foreign_key :geo_trees, :geographies, column: :child_id
    rename_column :geographies, :region, :geotype
    remove_index :geographies, [:universe, :handle, :incgrp2015]
    add_index :geographies, [:universe, :handle], :unique => true
    add_reference :series, :geography, foreign_key: true, after: :dataPortalName
  end
end
