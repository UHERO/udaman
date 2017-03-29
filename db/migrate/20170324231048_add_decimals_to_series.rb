class AddDecimalsToSeries < ActiveRecord::Migration
  def change
    add_column :series, :decimals, :integer
  end
end
