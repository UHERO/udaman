class AddMaskedToCategories < ActiveRecord::Migration
  def change
    add_column :categories, :masked, :boolean, null: false, default: false, after: :hidden
  end
end
