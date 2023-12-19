class AddBaseYearToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :base_year, :integer
  end
end
