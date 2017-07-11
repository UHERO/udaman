class CreateNtaUploads < ActiveRecord::Migration
  def change
    create_table :nta_uploads do |t|
      t.datetime :upload_at
      t.boolean :active
      t.string :series_filename
      t.string :last_error
      t.datetime :last_error_at
    end
    add_column :nta_uploads, :cats_status, "ENUM('processing','ok','fail')", after: :active
    add_column :nta_uploads, :series_status, "ENUM('processing','ok','fail')", after: :cats_status
  end
end
