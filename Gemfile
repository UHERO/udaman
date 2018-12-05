source 'http://rubygems.org'

gem 'rails', '~> 4.2', '>= 4.2.10'
gem 'bundler', '>= 1.8.4'

# Application Monitoring

gem 'capistrano-rvm'
gem 'rvm-capistrano'
gem 'capistrano-rails', '~> 1.1'
gem 'capistrano-bundler', '~> 1.1.3'
gem 'capistrano', '~> 3.2.1'
gem 'highline', '~> 1.6.0'
gem 'mysql2', '~> 0.4.0'
gem 'composite_primary_keys', '~> 8.1'
gem 'roo', '~> 2.4.0'
gem 'roo-xls', '>= 1.2.0'
gem 'httpclient'
gem 'rest-client', '~> 2.0'
gem 'spork-rails', '>= 4.0.0'
gem 'sidekiq', '~> 4.2', '>= 4.2.9'
gem 'sidekiq-status', '>= 1.0.1'
gem 'sinatra', '>= 1.2.8', :require => false
gem 'rack-protection', '~> 2.0.1'
gem 'sinatra_auth_github', '>= 1.2.0', :require => false
gem 'rubyzip', '~> 1.2.2'
gem 'capybara', '~> 2.18', '>= 2.18.0'
gem 'selenium-webdriver', '>= 3.13.0'
gem 'watir', '~> 6.11', '>= 6.11.0'
gem 'whenever'
gem 'mechanize', '>= 2.7.5'
gem 'net-sftp'
gem 'dalli', '~> 2.7'
gem 'rails-assets-select2', :source => 'http://rails-assets.org'
gem 'ancestry'
gem 'will_paginate', '~> 3.1.1'
gem 'font-awesome-sass'

# Dependencies related to upgrade to Ruby 2.3.0 and Rails 4.2
#gem 'devise-encryptable', '~> 0.2'
gem 'protected_attributes', '~> 1.1' # http://stackoverflow.com/questions/17371334/how-is-attr-accessible-used-in-rails-4
gem 'sassc-rails', '>= 2.0.0'
gem 'coffee-rails', '~> 4.2', '>= 4.2.2'
gem 'uglifier', '~> 3.0'
gem 'jquery-rails', '~> 4.3', '>= 4.3.3'
gem 'jquery-ui-rails', '~> 5.0', '>= 5.0.5'
gem 'devise', '~> 4.5', '>= 4.5.0'
gem 'stringex', '~> 2.6'

# Deploy with Capistrano
# gem 'capistrano'

# To use debugger (ruby-debug for Ruby 1.8.7+, ruby-debug19 for Ruby 1.9.2+)
# gem 'ruby-debug'
# gem 'ruby-debug19', :require => 'ruby-debug'

# Bundle the extra gems:
# gem 'bj'
gem 'nokogiri', '~> 1.8.5'
# gem 'sqlite3-ruby', :require => 'sqlite3'
# gem 'aws-s3', :require => 'aws/s3'
# Highcharts gem for forecast snapshot
gem 'highcharts-rails', '>= 6.0.3'

# Bundle gems for the local environment. Make sure to
# put test-only gems in this group so their generators
# and rake tasks are available in development mode:
# group :development, :test do
#   gem 'webrat'
# end

# Gems for Passenger
gem 'passenger', '>= 5.1.1'
gem 'sqlite3'

group :production do
  gem 'newrelic_rpm'
  gem 'newrelic-rake'
end

group :development, :test do
  gem 'rspec-rails', '~> 3.5', '>= 3.5.2'
  gem 'factory_bot_rails', '~> 4.11', '>= 4.11.1'
  gem 'faker', '~> 1.6'
  gem 'watchr'
  gem 'database_cleaner'
  gem 'debase'
end

group :development do
  gem 'ruby-debug-ide'
end

group :test do
  gem 'rake'
  gem 'rspec-sidekiq', '>= 2.2.0'
end
