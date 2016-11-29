class AddPercentAndRealToSeries < ActiveRecord::Migration
  def change
    add_column :series, :percent, :boolean
    add_column :series, :real, :boolean
  end
end
