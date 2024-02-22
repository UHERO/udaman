class CreateTransformations < ActiveRecord::Migration[5.2]
  def change
    create_table :transformations do |t|
      t.string :key
      t.string :description
      t.string :formula

      t.timestamps null: false
    end
  end
end
