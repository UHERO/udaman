class CreateReloadTrackers < ActiveRecord::Migration
  def change
    create_table :reload_trackers do |t|
      t.belongs_to :series
      t.datetime   :start_time
      t.datetime   :end_time
      t.timestamps
    end
  end
end
