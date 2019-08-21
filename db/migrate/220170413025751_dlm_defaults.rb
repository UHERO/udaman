class DlmDefaults < ActiveRecord::Migration[5.2]
  def change
    change_column_null :data_list_measurements, :list_order, false
    change_column_null :data_list_measurements, :indent, false
    change_column_default :data_list_measurements, :list_order, 0
    change_column_default :data_list_measurements, :indent, 'indent0'
  end
end
