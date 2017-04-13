class ChangeSeasonallyAdjustedType < ActiveRecord::Migration
  def change
    add_column :series, :seasonal_adjustment, %q(ENUM('Seasonally-adjusted', 'Non-seasonally-adjusted', 'Not-applicable')), after: :seasonally_adjusted
    add_column :measurements, :seasonal_adjustment, %q(ENUM('Seasonally-adjusted', 'Non-seasonally-adjusted', 'Not-applicable')), after: :seasonally_adjusted
  end
end
