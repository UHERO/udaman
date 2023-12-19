class CreateSources < ActiveRecord::Migration[5.2]
  def change
    create_table :sources do |t|
      t.string :description
      t.string :link

      t.timestamps null: false
    end
  end
end
