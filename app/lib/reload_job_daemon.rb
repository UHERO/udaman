class ReloadJobDaemon
  extend HelperUtilities

  def ReloadJobDaemon.perform(timer: 120)
    loop do  ## infinite
      job = ReloadJob.where(status: nil).order(:created_at).first
      if job.nil? || worker_busy?
        sleep timer.seconds
        next
      end
      Rails.logger.info { "reload_job_daemon: picked job #{job.id} off the queue" }
      job.update!(status: 'processing')
      begin
        xtra_params = Kernel::eval(job.params.to_s) || []
        param1 = xtra_params.shift
        param2 = xtra_params.shift || {}
        if param1.class == String
          Series.reload_with_dependencies(job.series.pluck(:id), param1, **param2)
        elsif param1.class == Hash
          Series.reload_with_dependencies(job.series.pluck(:id), **param1)
        else
          Series.reload_with_dependencies(job.series.pluck(:id))
        end
        DataPoint.update_public_all_universes if job.update_public
        job.update!(status: 'done', finished_at: Time.now)
      rescue => e
        job.update!(status: 'fail', finished_at: Time.now, error: e.message[0..253])
      end
      Rails.logger.info { "reload_job_daemon: finished running job #{job.id}" }
    end
  end

  def ReloadJobDaemon.enqueue(short_name, search, nightly: true, update_public: true)
    series = Series.search(search)
    params = [short_name, {nightly: nightly}]  ## extra parameters for Series.reload_with_dependencies call
    if series.empty?
      Rails.logger.warn { "ReloadJobDaemon.enqueue #{short_name}: No series found, no job queued" }
      return nil
    end
    id = nil
    begin
      job = ReloadJob.create!(user_id: 1, update_public: update_public, params: params.to_s)  ## User 1 is the system/cron user
      job.series << series
      id = job.id
      Rails.logger.info { "ReloadJobDaemon.enqueue #{short_name}: Reload job successfully queued" }
    rescue => e
      Rails.logger.error { "ReloadJobDaemon.enqueue #{short_name}: Job creation failed: #{e.message}" }
    end
    id
  end

private

  ### decide heuristically if the worker server Sidekiq is busy now
  def self.worker_busy?
    return true if daily_batch_running?
    return true if NewDbedtUpload.find_by(status: 'processing')
    return true if DvwUpload.find_by(series_status: 'processing')
    false
  end
end
