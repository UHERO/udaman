class ReloadJobDaemon

  def ReloadJobDaemon.perform
    loop do  ## infinite
      job = ReloadJob.where(status: nil).order(:created_at).first
      if job.nil? || worker_busy?
        sleep 120
        next
      end
      Rails.logger.info { "reload_job_daemon: picked job #{job.id} off the queue" }
      job.update!(status: 'processing')
      username = job.user.email.sub(/@.*/, '')
      begin
        Series.reload_with_dependencies(job.series.pluck(:id), username)
        job.update!(status: 'done', finished_at: Time.now)
      rescue => e
        job.update!(status: 'fail', finished_at: Time.now, error: e.message[0..253])
      end
      Rails.logger.info { "reload_job_daemon: finished running job #{job.id}" }
    end
  end

private

  ### decide heuristically if the worker server Sidekiq is busy now
  def self.worker_busy?
    return true if NewDbedtUpload.find_by(status: 'processing')
    return true if DvwUpload.find_by(series_status: 'processing')
    false
  end
end
