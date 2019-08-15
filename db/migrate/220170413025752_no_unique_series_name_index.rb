class NoUniqueSeriesNameIndex < ActiveRecord::Migration[5.2]
  def change
    remove_index :series, name: 'index_series_on_name'
    add_index :series, :name, unique: false
  end
end
