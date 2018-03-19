class CreateDataSourceActions < ActiveRecord::Migration
  def change
    create_table :data_source_actions do |t|
      t.integer :series_id, limit: 4
      t.integer :user_id, limit: 4
      t.string :user_email, limit: 255
      t.integer :data_source_id, limit: 4
      t.string :action
      t.text :eval, limit: 65535
      t.integer :priority, limit: 4

      t.timestamps
    end

    add_foreign_key :data_source_actions, :series
    # not adding data_source as a foreign key constraint, because we want to see delete actions
  end
end
