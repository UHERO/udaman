class AddThreeTsdsToForecastSnapshots < ActiveRecord::Migration[5.2]
  def change
    add_column :forecast_snapshots, :new_forecast_tsd_filename, :string
    add_column :forecast_snapshots, :new_forecast_tsd_label, :string
    add_column :forecast_snapshots, :old_forecast_tsd_filename, :string
    add_column :forecast_snapshots, :old_forecast_tsd_label, :string
    add_column :forecast_snapshots, :history_tsd_filename, :string
    add_column :forecast_snapshots, :history_tsd_label, :string
  end
end
