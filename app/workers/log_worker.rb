require 'sidekiq'
require 'redis'

class LogWorker
  include Sidekiq::Worker

  def perform(level)
    Rails.logger.level = level unless level.nil?  ## if nil, only do log output below to report current state
    Rails.logger.warn { "Logging level now set to #{Rails.logger.level} (DEBUG=0 INFO=1 WARN=2 ERROR=3 FATAL=4)" }
  end

end
