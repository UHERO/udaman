class SeriesReloadLog < ActiveRecord::Base
  self.primary_key = :batch_id, :series_id

  def SeriesReloadLog.purge_old_logs(horizon = 2.weeks)
    old_logs = SeriesReloadLog.find_by_sql [<<~SQL, horizon]
      select * from series_reload_logs where created_at < ?
    SQL
    old_logs.delete_all unless old_logs.empty?
  end
end
