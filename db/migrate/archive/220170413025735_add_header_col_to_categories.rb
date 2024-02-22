class AddHeaderColToCategories < ActiveRecord::Migration[5.2]
  def change
    add_column :categories, :header, :boolean, default: false, after: :hidden
  end
end
