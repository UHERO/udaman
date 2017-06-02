class ModsToDbedtUploads < ActiveRecord::Migration
  def change
    add_column :dbedt_uploads, :last_error, :string, after: :series_filename
    add_column :dbedt_uploads, :last_error_at, :datetime, after: :last_error
  end
end
