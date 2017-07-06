class ChangeUserRoleTypes < ActiveRecord::Migration
  def self.up
    change_column :users, :role, "ENUM('external', 'heco', 'internal', 'admin', 'dev')", null: false, default: 'external', after: :universe
  end
  def self.down
    change_column :users, :role, "ENUM('data_portal_user', 'heco', 'dbedt', 'internal', 'admin', 'dev')", null: true, default: nil
  end
end
