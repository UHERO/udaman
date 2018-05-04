require 'sidekiq'

Sidekiq.configure_server do |config|
  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] || ENV['REDIS_URL'] }
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV['REDIS_SIDEKIQ_URL'] || ENV['REDIS_URL'], size: 1 }
end

require 'sidekiq/web'
run Sidekiq::Web
