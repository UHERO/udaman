class AddOrderToCategory < ActiveRecord::Migration[5.2]
  def change
    add_column :categories, :order, :integer unless column_exists? :categories, :order
  end
end
