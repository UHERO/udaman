class CleanUpCategory < ActiveRecord::Migration[5.2]
  def change
    remove_column :categories, :parent if column_exists? :categories, :parent
  end
end
