class AddPresaveHookToDataSource < ActiveRecord::Migration[5.2]
  def self.up
    add_column :data_sources, :presave_hook, :string, null: true, after: :reload_nightly unless column_exists? :data_sources, :presave_hook
  end
  def self.down
    remove_column :data_sources, :presave_hook if column_exists? :data_sources, :presave_hook
  end
end
