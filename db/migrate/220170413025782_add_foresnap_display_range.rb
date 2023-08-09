class AddForesnapDisplayRange < ActiveRecord::Migration[5.2]
  def change
    add_column :forecast_snapshots, :disp_from, :string, null: true, after: :published
    add_column :forecast_snapshots, :disp_to,   :string, null: true, after: :disp_from
    remove_column :xseries, :units   ## cleanup from a previous change
  end
  ##
  ##
  ##   DONT FORGET TO BRING SCHEMA FILE BACK AND CHECK IT IN AFTER MIGRATION
  ##
  ##
end
