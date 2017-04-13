class ChangeSeasonallyAdjustedType < ActiveRecord::Migration
  def change
    change_column :series, :seasonally_adjusted, "ENUM('Seasonally-adjusted', 'Not-seasonally-adjusted', 'not-applicable')"
    change_column :measurements, :seasonally_adjusted, "ENUM('Seasonally-adjusted', 'Not-seasonally-adjusted', 'not-applicable')"
  end
end
