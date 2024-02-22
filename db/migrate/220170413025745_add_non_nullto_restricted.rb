class AddNonNulltoRestricted < ActiveRecord::Migration[5.2]
  def change
    change_column_null :series, :restricted, false
    change_column_null :measurements, :restricted, false
    change_column_default :measurements, :restricted, false
  end
end
