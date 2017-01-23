class AddIndentToDataListMeasurements < ActiveRecord::Migration
  def change
    add_column :data_list_measurements, :indent, 'ENUM(0, 1, 2)'
  end
end
