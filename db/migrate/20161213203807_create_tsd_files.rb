class CreateTsdFiles < ActiveRecord::Migration
  def change
    create_table :tsd_files do |t|
      t.integer :forecast_snapshot_id
      t.string :filename
      t.boolean :latest_forecast

      t.timestamps null: false
    end
  end
end
