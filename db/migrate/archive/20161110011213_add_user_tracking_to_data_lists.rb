class AddUserTrackingToDataLists < ActiveRecord::Migration[5.2]
  def change
    change_table :data_lists do |t|
      t.integer :created_by
      t.integer :updated_by
      t.integer :owned_by
    end
  end
end
