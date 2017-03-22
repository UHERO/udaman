class ChangesToColsInDbedtUploads < ActiveRecord::Migration
  def self.up
    change_column :dbedt_uploads, :active, "ENUM('yes','no','loading','fail')", :default => 'no'
    remove_column :dbedt_uploads, :load_status if column_exists? :dbedt_uploads, :load_status
  end
  def self.down
    change_column :dbedt_uploads, :active, :boolean, :null => true, :default => :null
    add_column :dbedt_uploads, :load_status, "ENUM('processing','ok','fail')", after: :series_status
  end
end
