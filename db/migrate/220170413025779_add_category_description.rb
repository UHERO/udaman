class AddCategoryDescription < ActiveRecord::Migration[5.2]
  def change
    add_column :categories, :description, :string, limit: 500, after: :meta
  end
end
