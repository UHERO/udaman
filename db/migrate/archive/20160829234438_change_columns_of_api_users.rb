class ChangeColumnsOfApiUsers < ActiveRecord::Migration
  def change
    remove_columns :api_users, :hostname, :key
    add_column :api_users, :auth_user_id, :string
  end
end
