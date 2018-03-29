Sidekiq.configure_server do |config|
  ## All Rails logging should go to the Sidekiq logger when (and only when) code is running in Sidekiq
  Rails.logger = Sidekiq::Logging.logger
  ActiveRecord::Base.logger = Sidekiq::Logging.logger
end
