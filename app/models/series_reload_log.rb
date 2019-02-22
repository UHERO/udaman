class SeriesReloadLog < ApplicationRecord
  self.primary_key = :batch_id, :series_id

  def SeriesReloadLog.purge_old_logs(horizon = 2.weeks)
    begin
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~SQL)
        delete from series_reload_logs where created_at < ?
      SQL
      stmt.execute(Time.now - horizon)
      stmt.close
      ### following is to test that automated email delivery works under R5. When confirmed, delete this stuff.
      raise 'THIS IS A TEST OF THE EMERGENCY EMAIL SYSTEM. IF THIS HAD BEEN AN ACTUAL EMERGENCY, YOU WOULD HAVE RECEIVED A REAL ERROR MESSAGE.'
    rescue => e
      Rails.logger.error { "SeriesReloadLog.purge_old_logs FAILURE: #{e.message}" }
      PackagerMailer.purge_log_notification(e.message).deliver
    end
  end
end
