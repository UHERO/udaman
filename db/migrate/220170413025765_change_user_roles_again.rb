class ChangeUserRolesAgain < ActiveRecord::Migration[5.2]
  def self.up
    change_column :users, :role, "ENUM('external', 'fsonly', 'internal', 'admin', 'dev')", null: false, default: 'external', after: :universe
  end
  def self.down
    change_column :users, :role, "ENUM('external', 'heco', 'internal', 'admin', 'dev')", null: false, default: 'external', after: :universe
  end
end
