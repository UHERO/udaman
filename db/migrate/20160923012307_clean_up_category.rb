class CleanUpCategory < ActiveRecord::Migration
  def change
    remove_column :categories, :parent if column_exists? :categories, :parent
  end
end
