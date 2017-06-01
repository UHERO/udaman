class DataSourceDownloadsMajorModelRefactor < ActiveRecord::Migration
  def self.up
    rename_table :data_source_downloads, :downloads
    create_table :data_source_downloads do |t|
      t.belongs_to :data_source
      t.belongs_to :download
      t.string :last_eval_checksum
      t.string :last_file_checksum
    end
    add_index :data_source_downloads, [:data_source_id, :download_id], unique: true
  end
  def self.down
    drop_table :data_source_downloads
    rename_table :downloads, :data_source_downloads
  end
end
