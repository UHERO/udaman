class CreateTsdFiles < ActiveRecord::Migration
  def change
    create_table :tsd_files do |t|
      t.string :path
      t.boolean :latest

      t.timestamps null: false
    end
  end
end
