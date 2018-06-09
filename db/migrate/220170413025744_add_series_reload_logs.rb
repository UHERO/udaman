class AddSeriesReloadLogs < ActiveRecord::Migration
  def change
    create_table :series_reload_logs, id: false do |t|
      t.string     :batch_id, null: false
      t.belongs_to :series, null: false
      t.integer    :depth
      t.string     :job_id
      t.string     :status
      t.timestamps
    end
    execute 'ALTER TABLE series_reload_logs ADD PRIMARY KEY (`batch_id`,`series_id`);'
  end
end
