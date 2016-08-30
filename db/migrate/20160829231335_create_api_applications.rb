class CreateApiApplications < ActiveRecord::Migration
  def change
    create_table :api_applications do |t|
      t.string :name
      t.string :hostname
      t.string :key

      t.timestamps null: false
    end
  end
end
