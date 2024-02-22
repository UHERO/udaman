class AddRoleToUsers < ActiveRecord::Migration[5.2]
  def change
    add_column :users, :role, "ENUM('data_portal_user', 'heco', 'internal', 'admin', 'dev')"
  end
end
