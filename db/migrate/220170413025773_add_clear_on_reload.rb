class AddClearOnReload < ActiveRecord::Migration[5.2]
  def self.up
    add_column :data_sources, :clear_before_load, :boolean, null: false, default: false, after: :pseudo_history unless column_exists? :data_sources, :clear_before_load
  end

  def self.down
    remove_column :data_sources, :clear_before_load, :boolean if column_exists? :data_sources, :clear_before_load
  end
end
