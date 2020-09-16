require 'sidekiq'
require 'redis'

class DbedtWorkerTest
  include Sidekiq::Worker
  sidekiq_options queue: :critical

  def initialize
    @logprefix = self.class
  end

  def perform
    mylogger :info, "Entering perform test"
    mylogger :info, "ENDING perform test"
  end

private

  def mylogger(level, message)
    Rails.logger.send(level) { "#{@logprefix}: #{message}" }
  end
end
