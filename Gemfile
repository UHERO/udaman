source "https://rubygems.org"

gem "rails", "~> 6.0.1"
gem "bundler", ">= 2.1.4"

# Application Monitoring

gem "highline", "~> 1.6.0"
gem "mysql2", "~> 0.5", ">= 0.5.3"
gem "composite_primary_keys"
gem "concurrent-ruby", "1.3.4"
gem "roo", "~> 2.8", ">= 2.8.2"
gem "roo-xls", "~> 1.2", ">= 1.2.0"
gem "matrix", "~> 0.4.2"
gem "httpclient"
gem "rest-client", "~> 2.0"
gem "sidekiq", "<7"
gem "sidekiq-status", ">= 2.1.3"
gem "sinatra", "~> 2.0", require: false
gem "sinatra_auth_github", "~> 2.0", require: false
gem "rack-protection", "~> 2.2.0"
gem "rubyzip", "~> 1.3.0"
gem "capybara", "~> 2.18", ">= 2.18.0"
gem "selenium-webdriver", ">= 3.13.0"
gem "whenever"
gem "net-sftp"
gem "dalli", "~> 3.2"
gem "rails-assets-select2",
    "~> 4.0.5",
    source: "http://insecure.rails-assets.org"
gem "ancestry"
gem "will_paginate", "~> 3.1", ">= 3.3.1"
gem "font-awesome-sass", "~> 5.6", ">= 5.6.1"

# Dependencies related to upgrade to Ruby 2.3.0 and Rails 4.2
gem "uglifier", "~> 3.0"
gem "jquery-rails", "~> 4.4"
gem "jquery-ui-rails", "~> 7.0.0"
gem "devise", "~> 4.7", ">= 4.7.1"
gem "stringex", "~> 2.8", ">= 2.8.5"

gem "nokogiri", "~> 1.14"

# Dependencies for updating to Rails 6.0 from 5.0
gem "net-http"
gem "net-imap"
gem "net-protocol"
gem "net-smtp"

# Highcharts gem for forecast snapshot
gem "highcharts-rails", ">= 6.0.3"

# Gems for Passenger
gem "passenger", ">= 6.0.18"
gem "sqlite3", "< 1.7.0"

group :development, :test do
  gem "rspec-rails", "~> 5.1.2"
  gem "factory_bot_rails", "~> 5.0", ">= 5.0.1"
  gem "faker", "~> 1.6"
end

group :development do
  gem "listen"
  gem "watchr"
  gem "ruby-lsp", require: false
end

group :test do
  gem "rake"
  gem "database_cleaner-active_record"
  gem "rspec-sidekiq", "~> 3.0", ">= 3.0.3"
  gem "rspec-core", "~> 3.12.0"
  gem "rspec-expectations", "~> 3.12.0"
  gem "rspec-mocks", "~> 3.12.0"
  gem "rspec-support", "~> 3.12.0"
end
