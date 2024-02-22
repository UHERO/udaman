class AddQuarantinedToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :quarantined, :boolean, default: false
  end
end
