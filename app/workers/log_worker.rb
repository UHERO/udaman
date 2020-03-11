require 'sidekiq'

class LogWorker
  include Sidekiq::Worker
  include Sidekiq::Status::Worker

  def perform(level)
    Rails.logger.level = level unless level.nil?  ## if nil, only do log output below to report current state
    Rails.logger.fatal { "Logging level now set to #{Rails.logger.level} (DEBUG=0 INFO=1 WARN=2 ERROR=3 FATAL=4)" }
      ## Logged to FATAL to make sure this message is output regardless of what the newly-set loglevel is
  end

end
