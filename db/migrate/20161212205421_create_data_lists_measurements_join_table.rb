class CreateDataListsMeasurementsJoinTable < ActiveRecord::Migration
  def change
    create_table :data_lists_measurements, id: false do |t|
      t.integer :data_list_id
      t.integer :measurement_id
      t.integer :list_order
    end

    add_index :data_lists_measurements, :data_list_id
    add_index :data_lists_measurements, :measurement_id
  end
end
