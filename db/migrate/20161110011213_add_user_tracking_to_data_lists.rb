class AddUserTrackingToDataLists < ActiveRecord::Migration
  def change
    change_table :data_lists do |t|
      t.string created_by
      t.string updated_by
      t.string owned_by
    end
  end
end
