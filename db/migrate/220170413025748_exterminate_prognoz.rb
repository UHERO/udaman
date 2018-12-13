class ExterminatePrognoz < ActiveRecord::Migration
  def change
    remove_column :series, :prognoz_data_file_id
    add_column :series, :scratch, :integer, null: false, default: 0
    drop_table :prognoz_data_files
  end
end
