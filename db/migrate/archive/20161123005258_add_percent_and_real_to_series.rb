class AddPercentAndRealToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :percent, :boolean
    add_column :series, :real, :boolean
  end
end
