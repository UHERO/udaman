class CreateGeographies < ActiveRecord::Migration
  def change
    create_table :geographies do |t|
      t.string :fips
      t.string :name
      t.string :handle

      t.timestamps null: false
    end
  end
end
