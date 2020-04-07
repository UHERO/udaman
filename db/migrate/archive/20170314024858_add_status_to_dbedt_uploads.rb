class AddStatusToDbedtUploads < ActiveRecord::Migration
  def change
    add_column :dbedt_uploads, :cats_status, "ENUM('processing','ok','fail')", after: :active
    add_column :dbedt_uploads, :series_status, "ENUM('processing','ok','fail')", after: :cats_status
  end
end
