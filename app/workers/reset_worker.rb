class ResetWorker
  include Sidekiq::Worker
  include Sidekiq::Status::Worker

  def perform
    Rails.cache.clear
    Rails.logger.warn { 'Rails file cache CLEARED' }
  end

end
