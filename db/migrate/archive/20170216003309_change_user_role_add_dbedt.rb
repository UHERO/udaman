class ChangeUserRoleAddDbedt < ActiveRecord::Migration[5.2]
  def self.up
    change_column :users, :role, "ENUM('data_portal_user', 'heco', 'dbedt', 'internal', 'admin', 'dev')"
  end
  def self.down
    change_column :users, :role, "ENUM('data_portal_user', 'heco', 'internal', 'admin', 'dev')"
  end
end
