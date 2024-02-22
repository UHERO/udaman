class AddDataPointRestoreTally < ActiveRecord::Migration[5.2]
  def self.up
    add_column :data_points, :restore_counter, :integer, :default => 0 unless column_exists? :data_points, :restore_counter
  end

  def self.down
    remove_column :data_points, :restore_counter if column_exists? :data_points, :restore_counter
  end
end
