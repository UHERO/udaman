class DropTransformations < ActiveRecord::Migration[5.2]
  def change
    drop_table :transformations if table_exists? :transformations
  end
end
