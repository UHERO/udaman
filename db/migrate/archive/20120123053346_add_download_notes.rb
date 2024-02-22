class AddDownloadNotes < ActiveRecord::Migration[5.2]
  def self.up
    add_column :data_source_downloads, :notes, :text unless column_exists? :data_source_downloads, :notes
  end

  def self.down
    remove_column :data_source_downloads, :notes if column_exists? :data_source_downloads, :notes
  end
end
