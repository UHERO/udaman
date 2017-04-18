class AddPrefixesAndDecimalsToMeasurements < ActiveRecord::Migration
  def change
    add_column :measurements, :decimals, :integer, after: :real
    add_column :series, :decimals, :integer, after: :real
    add_column :measurements, :table_prefix, :string, after: :data_portal_name
    add_column :measurements, :table_postfix, :string, after: :table_prefix
  end
end
