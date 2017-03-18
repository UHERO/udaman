# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class DbedtLoadWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id)
  end
end
