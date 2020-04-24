class DsdLogEntry < ApplicationRecord
  belongs_to :download

  def DsdLogEntry.purge_old_logs(horizon = 2.weeks)
    begin
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~SQL)
        delete from dsd_log_entries where created_at < ?
      SQL
      stmt.execute(Time.now - horizon)
      stmt.close
    rescue => e
      message = "DsdLogEntry.purge_old_logs FAILURE: #{e.message}"
      Rails.logger.error { message }
      PackagerMailer.purge_log_notification(message).deliver
    end
  end
end
