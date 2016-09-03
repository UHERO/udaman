class CleanUpApiUsers < ActiveRecord::Migration
  def change
    remove_reference :api_applications, :api_user, index: true, foreign_key: true if column_exists? :api_applications, :api_user_id
    drop_table :api_users if table_exists? :api_users
    add_column :api_applications, :github_nickname, :string unless column_exists? :api_applications, :github_nickname
  end
end
