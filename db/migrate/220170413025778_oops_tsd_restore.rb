class OopsTsdRestore < ActiveRecord::Migration[5.2]
  def change
    create_table "tsd_files", id: :integer, options: "ENGINE=InnoDB DEFAULT CHARSET=latin1", force: :cascade do |t|
      t.integer "forecast_snapshot_id"
      t.string "filename"
      t.boolean "latest_forecast"
      t.datetime "created_at", null: false
      t.datetime "updated_at", null: false
    end
  end
end
