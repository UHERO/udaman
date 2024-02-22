class AddDataSourceDownloadHandles < ActiveRecord::Migration[5.2]
  def self.up
    add_column :data_source_downloads, :handle, :string unless column_exists? :data_source_downloads, :handle
  end

  def self.down
    remove_column :data_source_downloads, :handle if column_exists? :data_source_downloads, :handle
  end
end
