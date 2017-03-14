class AddStatusToDbedtUploads < ActiveRecord::Migration
  def change
    add_column :dbedt_uploads, :status, "ENUM('processing','ok','fail')", after: :active
  end
end
