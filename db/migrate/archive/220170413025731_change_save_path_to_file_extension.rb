class ChangeSavePathToFileExtension < ActiveRecord::Migration[5.2]
  def self.up
    rename_column :downloads, :save_path, :save_path_obsolete if column_exists? :downloads, :save_path
    add_column :downloads, :filename_ext, %q(ENUM('xlsx','xls','zip','csv','txt','pdf')), after: :url
  end
  def self.down
    remove_column :downloads, :filename_ext if column_exists? :downloads, :filename_ext
    rename_column :downloads, :save_path_obsolete, :save_path if column_exists? :downloads, :save_path_obsolete
  end
end
