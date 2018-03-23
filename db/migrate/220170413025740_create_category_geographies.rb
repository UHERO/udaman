class CreateCategoryGeographies < ActiveRecord::Migration
  def change
    create_table :category_geographies, id: false do |t|
      t.belongs_to :category, index: true
      t.belongs_to :geography, index: true
    end
    add_index :category_geographies, [:category_id, :geography_id], unique: true
  end
end
