class CreateApiUsers < ActiveRecord::Migration[5.2]
  def change
    create_table :api_users do |t|
      t.string :key
      t.string :email
      t.string :name

      t.timestamps null: false
    end
  end
end
