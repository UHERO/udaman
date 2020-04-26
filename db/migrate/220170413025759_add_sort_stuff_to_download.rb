class AddSortStuffToDownload < ActiveRecord::Migration[5.2]
  def change
    add_column :downloads, :sort2, :integer, after: :foo
    add_column :downloads, :sort1, :integer, after: :foo
  end
end
