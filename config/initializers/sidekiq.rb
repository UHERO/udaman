Sidekiq.configure_server do |config|
  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] || ENV['REDIS_URL'] }

  ## All Rails logging should go to the Sidekiq logger when code is running in Sidekiq.
  ## But it turns out this only works when logger is invoked as Rails.logger, but cases
  ## where it is invoked only as logger, output goes to <environment>.log file. Will
  ## solve the problem later.
  Rails.logger = Sidekiq::Logging.logger
end

# https://github.com/mperham/sidekiq/wiki/Using-Redis
Sidekiq.configure_client do |config|
  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] || ENV['REDIS_URL'] }
end
