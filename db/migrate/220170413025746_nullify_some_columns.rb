class NullifySomeColumns < ActiveRecord::Migration[5.2]
  def change
    change_column_null :users, :password_salt, true
  end
end
