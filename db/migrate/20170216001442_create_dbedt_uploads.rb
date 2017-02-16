class CreateDbedtUploads < ActiveRecord::Migration
  def change
    create_table :dbedt_uploads do |t|
      t.datetime :upload_at
      t.string :cats_file
      t.string :series_file
    end
  end
end
