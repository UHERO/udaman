class RenameColumnOrderInCategories < ActiveRecord::Migration
  def change
    rename_column :categories, :order, :list_order
  end
end
