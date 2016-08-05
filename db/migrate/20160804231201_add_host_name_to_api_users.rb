class AddHostNameToApiUsers < ActiveRecord::Migration
  def change
    add_column :api_users, :hostname, :string
  end
end
