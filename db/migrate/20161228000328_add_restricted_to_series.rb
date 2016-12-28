class AddRestrictedToSeries < ActiveRecord::Migration
  def change
    add_column :series, :restricted, :boolean, default: false
  end
end
