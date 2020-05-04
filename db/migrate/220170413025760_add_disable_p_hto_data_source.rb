class AddDisablePHtoDataSource < ActiveRecord::Migration[5.2]
  def change
    add_column :data_sources, :disabled, :boolean, null: false, default: false, after: :reload_nightly unless column_exists? :data_sources, :disabled
    add_column :data_sources, :pseudo_history, :boolean, null: false, default: false, after: :reload_nightly unless column_exists? :data_sources, :pseudo_history
    add_column :downloads, :date_sensitive, :boolean, null: false, default: false, after: :last_change_at unless column_exists? :downloads, :date_sensitive
    change_column :data_sources, :priority, :integer, default: 100, after: :series_id  ## just move it to the left
    change_column :data_sources, :runtime, :float, after: :presave_hook  ## just move it to the right
  end
end
