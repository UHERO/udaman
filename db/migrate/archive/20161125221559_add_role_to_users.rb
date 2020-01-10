class AddRoleToUsers < ActiveRecord::Migration
  def change
    add_column :users, :role, "ENUM('data_portal_user', 'heco', 'internal', 'admin', 'dev')"
  end
end
