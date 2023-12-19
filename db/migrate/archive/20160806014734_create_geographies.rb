class CreateGeographies < ActiveRecord::Migration[5.2]
  def change
    create_table :geographies do |t|
      t.string :fips
      t.string :display_name
      t.string :display_name_short
      t.string :handle

      t.timestamps null: false
    end
  end
end
