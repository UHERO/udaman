class AddForecastSnapshotIdToTsdFiles < ActiveRecord::Migration
  def change
    add_column :tsd_files, :forecast_snapshot_id, :int
  end
end
