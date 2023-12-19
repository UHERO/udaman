class CreateDataLists < ActiveRecord::Migration[5.2]
  def self.up
    create_table :data_lists unless table_exists? :data_lists do |t|
      t.string :name
      t.text :list
      t.integer :startyear
      t.integer :endyear
      t.string :startdate
      t.string :enddate

      t.timestamps
    end
  end

  def self.down
    drop_table :data_lists if table_exists? :data_lists
  end
end
