Sidekiq.configure_server do |config|
  ## All Rails logging should go to the Sidekiq logger when code is running in Sidekiq
  # but this doesn't seem to be working as expected at present :(
  Rails.logger = Sidekiq::Logging.logger

  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] }
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] }
end
