class DataSourceDownloadsMajorModelRefactor < ActiveRecord::Migration
  def self.up
    drop_table :downloads if table_exists? :downloads
    rename_table :data_source_downloads, :downloads
    add_column :downloads, :last_download_at, :datetime, after: :updated_at
    add_column :downloads, :last_change_at, :datetime, after: :last_download_at
    rename_column :dsd_log_entries, :data_source_download_id, :download_id
    create_table :data_source_downloads do |t|
      t.belongs_to :data_source
      t.belongs_to :download
      t.datetime :last_file_vers_used, null: false, default: Time.at(0)
      t.string :last_eval_options_used, limit: 1000
    end
    add_index :data_source_downloads, [:data_source_id, :download_id], unique: true
  end
  def self.down
    drop_table :data_source_downloads if table_exists? :data_source_downloads
    remove_column :downloads, :last_download_at, :datetime
    remove_column :downloads, :last_change_at, :datetime
    rename_table :downloads, :data_source_downloads
    rename_column :dsd_log_entries, :download_id, :data_source_download_id
  end
end
