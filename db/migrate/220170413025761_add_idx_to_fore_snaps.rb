class AddIndexToForeSnaps < ActiveRecord::Migration[5.2]
  def change
    add_index :forecast_snapshots, [:name, :version], unique: true unless index_exists? :forecast_snapshots, [:name, :version]
    change_column :forecast_snapshots, :comments, :text, after: :history_tsd_label    ### just move the position for convenience
  end
end
