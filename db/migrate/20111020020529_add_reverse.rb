class AddReverse < ActiveRecord::Migration
  def self.up
    add_column :data_load_patterns, :reverse, :boolean, :default => 0 unless column_exists? :data_load_patterns, :reverse
  end

  def self.down
    remove_column :data_load_patterns, :reverse if column_exists? :data_load_patterns, :reverse
  end
end
