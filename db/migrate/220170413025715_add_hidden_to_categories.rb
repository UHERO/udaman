class AddHiddenToCategories < ActiveRecord::Migration
  def change
    add_column :categories, :hidden, :boolean, after: :updated_at
  end
end
