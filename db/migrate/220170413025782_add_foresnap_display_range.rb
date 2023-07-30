class AddForesnapDisplayRange < ActiveRecord::Migration[5.2]
#
##
#
##  RENUMBER THIS MIGRATION IF NEEDED, DEPENDING ON RELEASE ORDER
#
##
#
  def change
    add_column :forecast_snapshots, :disp_from, :string, null: true, after: :published
    add_column :forecast_snapshots, :disp_to,   :string, null: true, after: :disp_from
  end
end
