class AddRestrictedToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :restricted, :boolean, default: false
  end
end
