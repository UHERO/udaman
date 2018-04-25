class RemoveRestoreCounter < ActiveRecord::Migration
  def change
    remove_column :data_points, :restore_counter if column_exists? :data_points, :restore_counter
  end
end
