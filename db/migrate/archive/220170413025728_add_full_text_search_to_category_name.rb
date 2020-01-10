class AddFullTextSearchToCategoryName < ActiveRecord::Migration
  def change
    add_index :categories, :name, type: :fulltext
  end
end

