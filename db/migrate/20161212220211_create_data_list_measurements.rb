class CreateDataListMeasurements < ActiveRecord::Migration
  def change
    create_table :data_list_measurements do |t|
      t.belongs_to :data_list, index: true
      t.belongs_to :measurement, index: true
      t.integer :list_order
    end
    add_index :data_list_measurements, [:data_list_id, :measurement_id], unique: true
  end
end
