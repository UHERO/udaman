module Debugging

  def set_sidekiq_debug_level(level)
    job_id = LogWorker.perform_async(level)
    done = false
    until done
      puts 'Checking for completion'
      sleep 1
      status = Sidekiq::Status::status(job_id)
      done = status == :complete
    end
    puts 'Done'
  end

end
