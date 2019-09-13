class NullifySomeColumns < ActiveRecord::Migration
  def change
    change_column_null :users, :password_salt, true
  end
end
