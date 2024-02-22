class CreateExports < ActiveRecord::Migration[5.2]
  def change
    create_table :exports do |t|
      t.string :name
      t.integer :created_by
      t.integer :updated_by
      t.integer :owned_by

      t.timestamps null: false
    end
  end
end
