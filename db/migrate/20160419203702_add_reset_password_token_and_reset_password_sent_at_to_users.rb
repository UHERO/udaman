class AddResetPasswordTokenAndResetPasswordSentAtToUsers < ActiveRecord::Migration
  def self.up
    add_column :users, :reset_password_sent_at, :datetime unless column_exists? :users, :reset_password_sent_at
  end

  def self.down
    remove_column :users, :reset_password_sent_at if column_exists? :users, :reset_password_sent_at
  end
end
