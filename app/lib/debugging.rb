module Debugging
  require 'sidekiq'
  require 'sidekiq-status'

  def set_sidekiq_debug_level(level = nil)
    job_id = LogWorker.perform_async(level)
    done = false
    sleep 1
    while true
      status = Sidekiq::Status::status(job_id)
      break if status == :complete
      puts "Waiting for completion of job #{job_id} (still :#{status})"
      sleep 3
    end
    puts 'Done'
  end

end
