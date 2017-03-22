class ChangesToColsInDbedtUploads < ActiveRecord::Migration
  def change
    change_column :dbedt_uploads, :active, "ENUM('yes','no','loading','fail')", :default => 'no'
    remove_column :dbedt_uploads, :load_status if column_exists? :dbedt_uploads, :load_status
  end
end
