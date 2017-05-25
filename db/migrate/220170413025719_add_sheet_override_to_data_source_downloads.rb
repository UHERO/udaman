class AddSheetOverrideToDataSourceDownloads < ActiveRecord::Migration
  def change
    add_column :data_source_downloads, :sheet_override, :string, after: :file_to_extract
  end
end
