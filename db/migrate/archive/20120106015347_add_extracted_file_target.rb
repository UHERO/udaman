class AddExtractedFileTarget < ActiveRecord::Migration  
  def self.up
    add_column :data_source_downloads, :file_to_extract, :string unless column_exists? :data_source_downloads, :file_to_extract
  end

  def self.down
    remove_column :data_source_downloads, :file_to_extract if column_exists? :data_source_downloads, :file_to_extract
  end
end
