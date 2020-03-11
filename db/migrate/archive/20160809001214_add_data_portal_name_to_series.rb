class AddDataPortalNameToSeries < ActiveRecord::Migration
  def change
    add_column :series, :dataPortalName, :string
  end
end
