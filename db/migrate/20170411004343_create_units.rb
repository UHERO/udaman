class CreateUnits < ActiveRecord::Migration
  def change
    create_table :units do |t|
      t.string :short_label
      t.string :long_label

      t.timestamps null: false
    end
  end
end
