class AddResetPasswordTokenAndResetPasswordSentAtToUsers < ActiveRecord::Migration
  def self.up
    add_column :users, :reset_password_token, :string
    add_column :users, :reset_password_sent_at, :string
  end

  def self.down
    remove_column :users, :reset_password_token
    remove_column :users, :reset_password_sent_at
  end
end
