class AddIndexToForeSnaps < ActiveRecord::Migration[5.2]
  def self.up
    add_index :forecast_snapshots, [:name, :version], unique: true unless index_exists? :forecast_snapshots, [:name, :version]
    change_column :forecast_snapshots, :comments, :text, after: :history_tsd_label    ### just move position for convenience
  end

  def self.down
    remove_index :forecast_snapshots, [:name, :version], unique: true if index_exists? :forecast_snapshots, [:name, :version]
  end
end
