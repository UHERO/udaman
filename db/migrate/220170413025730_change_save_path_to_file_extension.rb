class ChangeSavePathToFileExtension < ActiveRecord::Migration
  def self.up
    rename_column :downloads, :save_path, :save_path_obsolete if column_exists? :save_path
    add_column :downloads, :save_path_ext, %q(ENUM('xlsx','xls','zip','csv','txt','pdf')), null: false, after: :url
  end
  def self.down
    remove_column :downloads, :save_path_ext if column_exists? :save_path_ext
    rename_column :downloads, :save_path_obsolete, :save_path if column_exists? :save_path_obsolete
  end
end
