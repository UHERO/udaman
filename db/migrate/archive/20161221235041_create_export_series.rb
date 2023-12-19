class CreateExportSeries < ActiveRecord::Migration[5.2]
  def change
    create_table :export_series do |t|
      t.belongs_to :export, index: true
      t.belongs_to :series, index: true
      t.integer :list_order
    end
    add_index :export_series, [:export_id, :series_id], unique: true
  end
end
