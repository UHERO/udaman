class AddIndentToDataListMeasurements < ActiveRecord::Migration
  def change
    add_column :data_list_measurements, :indent, "ENUM('none','ind1','ind2')"
  end
end
