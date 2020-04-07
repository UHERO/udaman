class CreateSourceDetails < ActiveRecord::Migration
  def change
    create_table :source_details do |t|
      t.text :description

      t.timestamps null: false
    end
  end
end
