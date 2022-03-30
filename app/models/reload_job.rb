class ReloadJob < ApplicationRecord
  include Cleaning
  extend HelperUtilities
  belongs_to :user
  has_many :reload_job_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :reload_job_series

  def ReloadJob.purge_old_jobs(horizon = 1.week)
    begin
      ReloadJob.where('created_at < ?', Time.now - horizon).each do |job|
        job.destroy!   ## done within Rails/AR to enable ORM to also remove dependent bridge table records
      end
    rescue => e
      message = "ReloadJob.purge_old_jobs FAILURE: #{e.message}"
      Rails.logger.error { message }
      PackagerMailer.purge_log_notification(message).deliver
    end
  end

  def rerun_as(user = nil)
    raise 'rerun_as: argument is not a user' unless user.class == User
    new_job = ReloadJob.create!(user_id: user.id, params: [user.username, {nightly: true}].to_s) rescue raise('Failed to create ReloadJob object')
    new_job.series << self.series
  end

  def ReloadJob.busy?
    return 'System busy - Please try again after 9:00 AM' if daily_batch_running?
    return 'System busy - Please try again in 1 hour'     if ReloadJob.find_by(status: 'processing')
    false
  end
end
