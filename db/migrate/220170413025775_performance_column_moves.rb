class PerformanceColumnMoves < ActiveRecord::Migration[5.2]
  def change
    change_column :series, :xseries_id, :integer, after: :id
    change_column :series, :unit_id, :integer, after: :geography_id
    change_column :series, :source_id, :integer, after: :unit_id
    change_column :series, :source_detail_id, :integer, after: :source_id
    add_column :series, :new_descrip, :string, limit: 500, after: :description
    add_column :series, :new_notes, :string, limit: 500, after: :source_link
  end
end
