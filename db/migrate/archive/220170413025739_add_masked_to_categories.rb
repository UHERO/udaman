class AddMaskedToCategories < ActiveRecord::Migration[5.2]
  def change
    add_column :categories, :masked, :boolean, null: false, default: false, after: :hidden
  end
end
