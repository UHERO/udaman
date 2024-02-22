class AddDecimalsToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :decimals, :integer
  end
end
