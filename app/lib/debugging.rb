module Debugging
  require 'sidekiq'
  require 'sidekiq-status'

  def set_sidekiq_debug_level(level)
    job_id = LogWorker.perform_async(level)
    sleep 1
    until Sidekiq::Status::status(job_id) == :complete
      puts 'Waiting for completion...'
      sleep 1
    end
    puts 'Done'
  end

end
