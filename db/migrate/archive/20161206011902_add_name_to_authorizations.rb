class AddNameToAuthorizations < ActiveRecord::Migration[5.2]
  def change
    add_column :authorizations, :name, :string
    add_column :authorizations, :email, :string
  end
end
