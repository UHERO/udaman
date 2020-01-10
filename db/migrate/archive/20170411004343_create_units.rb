class CreateUnits < ActiveRecord::Migration
  def change
    create_table :units do |t|
      t.string :short_label
      t.string :long_label

      t.timestamps null: false
    end
    add_index :units, [:short_label, :long_label], :unique => true
    add_reference :series, :unit, foreign_key: true, after: :unitsLabelShort
    add_reference :measurements, :unit, foreign_key: true, after: :units_label_short
  end
end
