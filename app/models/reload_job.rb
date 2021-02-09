class ReloadJob < ApplicationRecord
  include Cleaning
  belongs_to :user
  has_many :reload_job_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :reload_job_series

  def ReloadJob.purge_old_jobs(horizon = 2.weeks)
    begin
      ReloadJob.where('created_at < ?', Time.now - horizon).each do |job|
        job.destroy!   ## done within Rails/AR to enable ORM to also remove dependent records
      end
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
