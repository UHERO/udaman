class AddIndentToDataListMeasurements < ActiveRecord::Migration[5.2]
  def change
    add_column :data_list_measurements, :indent, "ENUM('indent0','indent1','indent2','indent3')"
  end
end
