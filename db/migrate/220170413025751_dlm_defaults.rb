class DlmDefaults < ActiveRecord::Migration[5.2]
  def change
    change_column_null :data_list_measurements, :list_order, false
    change_column_default :data_list_measurements, :list_order, 0
  end
end
