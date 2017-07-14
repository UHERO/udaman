class SomeMiscChanges < ActiveRecord::Migration
  def change
    add_column :api_applications, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_index :api_applications, [:universe, :name], :unique => true
    add_column :geographies, :region, :string, after: :handle
    add_column :geographies, :subregion, :string, after: :region
    add_column :geographies, :incgrp2015, :string, after: :subregion
    add_index :geographies, [:universe, :handle, :incgrp2015], :unique => true
    add_column :units, :universe, %q(ENUM('UHERO', 'DBEDT', 'NTA')), null: false, default: 'UHERO', after: :id
    add_index :units, [:universe, :short_label, :long_label], :unique => true
  end
end
