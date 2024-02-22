class AddHiddenToCategories < ActiveRecord::Migration[5.2]
  def change
    add_column :categories, :hidden, :boolean, default: false, after: :updated_at
  end
end
