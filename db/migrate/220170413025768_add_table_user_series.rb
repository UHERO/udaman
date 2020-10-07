class AddTableUserSeries < ActiveRecord::Migration[5.2]
  def self.up
    create_table :user_series do |t|
      t.belongs_to :user, index: true
      t.belongs_to :series, index: true
    end
    add_index :user_series, [:user_id, :series_id], unique: true
  end

  def self.down
    drop_table :user_series if table_exists? :user_series
  end
end
