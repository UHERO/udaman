require 'sidekiq'
require 'redis'

class LogWorker
  include Sidekiq::Worker

  def perform(level)
    Rails.logger.level = level unless level.nil?  ## if nil, there's only logger output to report current state
    Rails.logger.warn { "Logging level set to #{level}" }
  end

end
