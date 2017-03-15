class AddBaseYearToSeries < ActiveRecord::Migration
  def change
    add_column :series, :base_year, :integer
  end
end
