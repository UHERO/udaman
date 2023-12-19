class AddFullTextSearchToCategoryName < ActiveRecord::Migration[5.2]
  def change
    add_index :categories, :name, type: :fulltext
  end
end

