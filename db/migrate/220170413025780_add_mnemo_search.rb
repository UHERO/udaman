class AddMnemoSearch < ActiveRecord::Migration[5.2]
  def change
    add_column :users, :mnemo_search, :boolean, null: false, default: false, after: :role
  end
end
