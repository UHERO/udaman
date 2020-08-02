class NewDbedtUploadsTable < ActiveRecord::Migration[5.2]
  def change
    create_table :new_dbedt_uploads do |t|
      t.datetime :upload_at
      t.boolean  :active
      t.string   :filename
      t.datetime :last_error_at
      t.string   :last_error
    end
    add_column :new_dbedt_uploads, :status, "ENUM('processing','ok','fail')", after: :active
  end
end
