class CreateSourceDetails < ActiveRecord::Migration[5.2]
  def change
    create_table :source_details do |t|
      t.text :description

      t.timestamps null: false
    end
  end
end
