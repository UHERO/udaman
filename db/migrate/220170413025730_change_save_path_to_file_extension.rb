class ChangeSavePathToFileExtension < ActiveRecord::Migration
  def self.up
    rename_column :downloads, :save_path, :save_path_obsolete if column_exists? :downloads, :save_path
    add_column :downloads, :filename_ext, %q(ENUM('xlsx','xls','zip','csv','txt','pdf')), null: false, after: :url
    change_column :downloads, :handle, :string, null: false, after: :id  ## force handle to be specified
  end
  def self.down
    remove_column :downloads, :filename_ext if column_exists? :downloads, :filename_ext
    rename_column :downloads, :save_path_obsolete, :save_path if column_exists? :downloads, :save_path_obsolete
  end
end
