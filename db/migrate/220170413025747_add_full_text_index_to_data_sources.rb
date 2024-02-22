class AddFullTextIndexToDataSources < ActiveRecord::Migration[5.2]
  def change
    add_index :data_sources, :description,  type: :fulltext
    add_index :data_sources, :eval,         type: :fulltext
    add_index :data_sources, :dependencies, type: :fulltext
  end
end
