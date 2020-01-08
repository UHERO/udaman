class AddNameToAuthorizations < ActiveRecord::Migration
  def change
    add_column :authorizations, :name, :string
    add_column :authorizations, :email, :string
  end
end
