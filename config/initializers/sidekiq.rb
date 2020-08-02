Sidekiq.configure_server do |config|
  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] || ENV['REDIS_URL'] }

  # accepts :expiration (optional)
  Sidekiq::Status.configure_server_middleware config, expiration: 40.minutes

  # accepts :expiration (optional)
  Sidekiq::Status.configure_client_middleware config, expiration: 40.minutes

  ## All Rails logging should go to the Sidekiq logger when code is running in Sidekiq.
  ## But it turns out this only works when logger is invoked as Rails.logger, but cases
  ## where it is invoked only as logger, output goes to <environment>.log file.
  Rails.logger = Sidekiq::Logging.logger
end

# https://github.com/mperham/sidekiq/wiki/Using-Redis
Sidekiq.configure_client do |config|
  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] || ENV['REDIS_URL'] }

  # accepts :expiration (optional)
  Sidekiq::Status.configure_client_middleware config, expiration: 40.minutes
end
