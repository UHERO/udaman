class AddOrderToCategory < ActiveRecord::Migration
  def change
    add_column :categories, :order, :integer unless column_exists? :categories, :order
  end
end
