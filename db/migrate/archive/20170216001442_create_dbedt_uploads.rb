class CreateDbedtUploads < ActiveRecord::Migration[5.2]
  def change
    create_table :dbedt_uploads do |t|
      t.datetime :upload_at
      t.boolean :active
      t.string :cats_filename
      t.string :series_filename
    end
  end
end
