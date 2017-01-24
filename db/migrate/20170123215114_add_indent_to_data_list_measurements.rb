class AddIndentToDataListMeasurements < ActiveRecord::Migration
  def change
    add_column :data_list_measurements, :indent, "ENUM('none','indent1','indent2')"
  end
end
