class CreateReloadTrackers < ActiveRecord::Migration
  def change
    create_table :reload_trackers do |t|
      t.belongs_to :series
      t.date       :start_time
      t.date       :end_time
      t.timestamps
    end
  end
end
