class ReloadJob < ApplicationRecord
  extend HelperUtilities
  belongs_to :user
  has_many :reload_job_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :reload_job_series

  def ReloadJob.purge_old_jobs(horizon = 1.week)
    begin
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~MYSQL)
        delete from reload_jobs where created_at < ?
      MYSQL
      stmt.execute(Time.now - horizon)
      stmt.close
    rescue => e
      message = "ReloadJob.purge_old_jobs FAILURE: #{e.message}"
      Rails.logger.error { message }
      PackagerMailer.purge_log_notification(message).deliver
    end
  end

  def ReloadJob.busy?
    return 'System busy - Please try again after 9:00 AM' if daily_batch_running?
    return 'System busy - Please try again in 1 hour'     if ReloadJob.find_by(status: 'processing')
    false
  end
end
