class AddPrefixesAndDecimalsToMeasurements < ActiveRecord::Migration[5.2]
  def change
    add_column :measurements, :decimals, :integer, default: 2, after: :real
    change_column :series, :decimals, :integer, default: 2, after: :real
    add_column :measurements, :table_prefix, :string, after: :data_portal_name
    add_column :measurements, :table_postfix, :string, after: :table_prefix
  end
end
