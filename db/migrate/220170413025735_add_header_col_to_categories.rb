class AddHeaderColToCategories < ActiveRecord::Migration
  def change
    add_column :categories, :header, :boolean, default: false
  end
end
