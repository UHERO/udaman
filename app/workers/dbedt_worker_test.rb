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
    output = %x{ssh uhero2.colo.hawaii.edu "bin/clear_api_cache.sh /v1/"}
    if $?.success?
      if output.blank?
        mylogger :info, 'worker_tasks: API cache clear SUCCESS but nothing cleared'
      else
        mylogger :info, "worker_tasks: API cache clear SUCCESS: #{output} entries cleared"
      end
    else
      mylogger :info, "worker_tasks: API cache clear FAIL: #{$?}"
    end
    mylogger :info, "ENDING perform test"
  end

private

  def mylogger(level, message)
    Rails.logger.send(level) { "#{@logprefix}: #{message}" }
  end
end
