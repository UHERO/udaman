class ChangeSeasonallyAdjustedType < ActiveRecord::Migration
  def change
    add_column :series, :seasonal_adjustment, %q(ENUM('Seasonally-adjusted', 'Not-seasonally-adjusted', 'not-applicable')), after: :seasonally_adjusted
    add_column :measurements, :seasonal_adjustment, %q(ENUM('Seasonally-adjusted', 'Not-seasonally-adjusted', 'not-applicable')), after: :seasonally_adjusted
  end
end
