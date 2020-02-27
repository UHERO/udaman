module Debugging
  require 'sidekiq'
  require 'sidekiq-status'

  def set_sidekiq_debug_level(level = nil)
    job_id = LogWorker.perform_async(level)
    sleep 1
    iter = 0
    while true
      status = Sidekiq::Status::status(job_id)
      break if status == :complete
      Rails.logger.info { "Waiting for completion of job #{job_id} (still :#{status})" }
      sleep 3
      iter += 1
      break if iter > 5
    end
  end

end
