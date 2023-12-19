class MakeSeriesNamesUnique < ActiveRecord::Migration[5.2]
  def up
    remove_index :series, :name if index_exists? :series, :name
    add_index :series, :name, unique: true, using: 'btree'
  end
  def down
    remove_index :series, :name if index_exists? :series, :name
    add_index :series, :name, using: 'btree'
  end
end
