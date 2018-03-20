class AddMaskedToCategories < ActiveRecord::Migration
  def change
    add_column :categories, :masked, :integer, null: false, default: 0, after: :hidden
  end
end
