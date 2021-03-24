class EnableForecastSeries < ActiveRecord::Migration[5.2]
  def self.up
    change_column :series, :xseries_id, :integer, after: :id
    change_column :series, :geography_id, :integer, after: :id
    add_column :series, :forecast, :boolean, null: false, default: false, after: :universe unless column_exists? :series, :forecast
  end

  def self.down
    remove_column :series, :forecast, :boolean if column_exists? :series, :forecast
  end
end
