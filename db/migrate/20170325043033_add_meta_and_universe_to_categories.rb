class AddMetaAndUniverseToCategories < ActiveRecord::Migration
  def change
    add_column :categories, :meta, :string
    add_column :categories, :universe, :string
  end
end
