require 'sidekiq'
require 'redis'

class PublicDataPointsWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform
    Series.where(:quarantined => false).each do |series|
      ActiveRecord::Base.connection.execute %Q(
          SQL CODE HERE
          ;)
    end
  end
end
