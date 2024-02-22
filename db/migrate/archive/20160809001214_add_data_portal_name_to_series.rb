class AddDataPortalNameToSeries < ActiveRecord::Migration[5.2]
  def change
    add_column :series, :dataPortalName, :string
  end
end
