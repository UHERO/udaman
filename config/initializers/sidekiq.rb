Sidekiq.configure_server do |config|
  ## All Rails logging should go to the Sidekiq logger when code is running in Sidekiq
  Rails.logger = Sidekiq::Logging.logger

end
