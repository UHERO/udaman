class AddQuarantinedToSeries < ActiveRecord::Migration
  def change
    add_column :series, :quarantined, :boolean, default: false
  end
end
