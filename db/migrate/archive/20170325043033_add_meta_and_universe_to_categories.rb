class AddMetaAndUniverseToCategories < ActiveRecord::Migration[5.2]
  def change
    add_column :categories, :meta, :string
    add_column :categories, :universe, :string
  end
end
