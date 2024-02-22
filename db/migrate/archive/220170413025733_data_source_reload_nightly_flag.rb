class DataSourceReloadNightlyFlag < ActiveRecord::Migration[5.2]
  def change
    add_column :data_sources, :reload_nightly, :boolean, default: true, after: :updated_at
    add_column :data_sources, :last_run_at, :datetime, after: :reload_nightly
  end
end
