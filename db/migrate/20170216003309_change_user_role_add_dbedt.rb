class ChangeUserRoleAddDbedt < ActiveRecord::Migration
  def change
    change_column :users, :role, "ENUM('data_portal_user', 'heco', 'dbedt', 'internal', 'admin', 'dev')"
  end
end
