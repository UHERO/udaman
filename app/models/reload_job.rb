class ReloadJob < ApplicationRecord
  include Cleaning
  belongs_to :user
  has_many :reload_job_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :reload_job_series

  def ReloadJob.purge_old_jobs(horizon = 2.weeks)
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
    ReloadJob.find_by(status: 'processing') ? true : false
  end
end
