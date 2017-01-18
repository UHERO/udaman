class DuplicateOrderColumnInCategories < ActiveRecord::Migration
  def self.up
    add_column :categories, :order, :integer, after: :list_order
    Category.update_all('categories.order = list_order')
  end

  def self.down
    remove_column :categories, :order if column_exists? :categories, :order
  end
end
