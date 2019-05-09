class CreateDvwUploads < ActiveRecord::Migration[5.2]
  def change
    create_table :dvw_uploads do |t|
      t.datetime :upload_at
      t.boolean :active
      t.string :filename
      t.string :last_error
      t.datetime :last_error_at
    end
    add_column :nta_uploads, :cats_status, %q{ENUM('processing','ok','fail')}, after: :active
    add_column :nta_uploads, :series_status, %q{ENUM('processing','ok','fail')}, after: :cats_status
  end
end
