class AddLoadStatusToDbedtUploads < ActiveRecord::Migration
  def change
    add_column :dbedt_uploads, :load_status, "ENUM('processing','ok','fail')", after: :series_status
  end
end
