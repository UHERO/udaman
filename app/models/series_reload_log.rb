class SeriesReloadLog < ActiveRecord::Base
  self.primary_key = :batch_id, :series_id

  def SeriesReloadLog.purge_old_logs(horizon = 2.weeks)
    begin
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~SQL)
        delete from series_reload_logs where created_at < ?
      SQL
      stmt.execute(Time.now - horizon)
      stmt.close
    rescue => e
      Rails.logger.error { "SeriesReloadLog.purge_old_logs FAILURE: #{e.message}" }
      PackagerMailer.purge_log_notification(e.message).deliver
    end
end
