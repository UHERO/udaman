class AddSeriesSlaveLogs < ActiveRecord::Migration
  def change
    create_table :series_slave_logs, id: false do |t|
      t.string     :batch_id, null: false
      t.belongs_to :series, null: false
      t.integer    :depth
      t.string     :message
      t.timestamps
    end
    execute 'ALTER TABLE words ADD PRIMARY KEY (`batch_id`,`series_id`);'
  end
end
