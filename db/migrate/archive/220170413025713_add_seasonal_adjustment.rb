class AddSeasonalAdjustment < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :seasonal_adjustment, %q(ENUM('seasonally_adjusted', 'not_seasonally_adjusted', 'not_applicable')), after: :seasonally_adjusted
    add_column :measurements, :seasonal_adjustment, %q(ENUM('seasonally_adjusted', 'not_seasonally_adjusted', 'not_applicable')), after: :seasonally_adjusted
  end
end
