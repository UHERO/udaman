class DuplicateOrderColumnInCategories < ActiveRecord::Migration
  def self.up
    add_column :categories, :order, :integer
    Category.update_all('order = list_order')
  end

  def self.down
    remove_column :categories, :order if column_exists? :categories, :order
  end
end
