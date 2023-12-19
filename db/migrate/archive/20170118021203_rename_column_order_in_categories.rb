class RenameColumnOrderInCategories < ActiveRecord::Migration[5.2]
  def change
    rename_column :categories, :order, :list_order
  end
end
