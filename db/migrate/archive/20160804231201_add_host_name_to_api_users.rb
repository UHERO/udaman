class AddHostNameToApiUsers < ActiveRecord::Migration[5.2]
  def change
    add_column :api_users, :hostname, :string
  end
end
