class AddKeepSheetToDataSourceDownloads < ActiveRecord::Migration
  def change
    add_column :data_source_downloads, :keep_sheet, :string, after: :file_to_extract
  end
end
