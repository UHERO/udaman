class SeriesReloadLog < ApplicationRecord
  self.primary_key = :batch_id, :series_id

  def SeriesReloadLog.purge_old_logs(horizon = 2.weeks)
    begin
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~MYSQL)
        delete from series_reload_logs where created_at < ?
      MYSQL
      stmt.execute(Time.now - horizon)
      stmt.close
    rescue => e
      message = "SeriesReloadLog.purge_old_logs FAILURE: #{e.message}"
      Rails.logger.error { message }
      PackagerMailer.purge_log_notification(message).deliver
    end
  end
end
