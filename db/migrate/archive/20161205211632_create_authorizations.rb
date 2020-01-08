class CreateAuthorizations < ActiveRecord::Migration
  def change
    create_table :authorizations, id: false do |t|
      t.references :user, foreign_key: true, null: false
      t.string :provider, null: false
      t.integer :provider_user_id, index: true, null: false
    end
  end
end
