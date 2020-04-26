class AddSortStuffToDownload < ActiveRecord::Migration[5.2]
  def change
    add_column :downloads, :sort2, :integer, after: :sheet_override unless column_exists? :downloads, :sort2
    add_column :downloads, :sort1, :integer, after: :sheet_override unless column_exists? :downloads, :sort1
    add_index :downloads, :handle, unique: true unless index_exists? :downloads, :handle
  end
end
