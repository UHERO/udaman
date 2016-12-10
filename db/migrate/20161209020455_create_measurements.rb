class CreateMeasurements < ActiveRecord::Migration
  def change
    create_table :measurements do |t|
      t.string :prefix, null: false
      t.string :data_portal_name
      t.string :units_label
      t.string :units_label_short
      t.boolean :percent
      t.boolean :real
      t.text :notes

      t.timestamps null: false
    end
  end
end
