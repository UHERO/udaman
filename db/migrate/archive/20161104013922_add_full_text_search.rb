class AddFullTextSearch < ActiveRecord::Migration[5.2]
  def change
    add_index :series, [:name, :dataPortalName, :description], name: 'name_data_portal_name_description', type: :fulltext
  end
end
