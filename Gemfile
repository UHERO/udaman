source 'http://rubygems.org'

gem 'rails', '~> 5.2.1'
gem 'bundler', '>= 1.8.4'

# Application Monitoring

gem 'capistrano-rvm'
gem 'rvm-capistrano'
gem 'capistrano-rails'
gem 'capistrano-bundler', '~> 1.0'
gem 'capistrano', '~> 3.0'
gem 'highline', '~> 1.6.0'
gem 'mysql2', '~> 0.5'
gem 'composite_primary_keys', '~> 11.0'
gem 'roo', '~> 2.4.0'
gem 'roo-xls'
gem 'httpclient'
gem 'rest-client', '~> 2.0'
## gem 'spork-rails'
gem 'sidekiq', '~> 5.2.0'
gem 'sidekiq-status'
gem 'sinatra', '~> 2.0', :require => false
gem 'rack-protection', '~> 2.0.0'
gem 'sinatra_auth_github', '~> 2.0', :require => false
gem 'rubyzip', '~> 1.2.1'
gem 'capybara', '~> 2.7'
gem 'selenium-webdriver', '>= 3.0.5'
gem 'watir', '~> 6.2', '>= 6.2.0'
gem 'whenever'
gem 'mechanize'
gem 'net-sftp'
gem 'dalli', '~> 2.7'
gem 'rails-assets-select2', :source => 'http://rails-assets.org'
gem 'ancestry'
gem 'will_paginate', '~> 3.1.1'
gem 'font-awesome-sass'

# Dependencies related to upgrade to Ruby 2.3.0 and Rails 4.2
### no longer need? gem 'protected_attributes', '~> 1.1' # http://stackoverflow.com/questions/17371334/how-is-attr-accessible-used-in-rails-4
gem 'coffee-rails', '~> 4.2.0'
gem 'sass-rails',   '~> 5.0'
gem 'uglifier', '~> 3.0'
gem 'jquery-rails'
gem 'jquery-ui-rails'
gem 'devise', '~> 4.0', '>= 4.4.0'
gem 'stringex', '~> 2.6'

# Deploy with Capistrano
# gem 'capistrano'

# To use debugger (ruby-debug for Ruby 1.8.7+, ruby-debug19 for Ruby 1.9.2+)
# gem 'ruby-debug'
# gem 'ruby-debug19', :require => 'ruby-debug'

# Bundle the extra gems:
# gem 'bj'
gem 'nokogiri', '~> 1.8.1'
# gem 'sqlite3-ruby', :require => 'sqlite3'
# gem 'aws-s3', :require => 'aws/s3'

# Highcharts gem for forecast snapshot
gem 'highcharts-rails'

# Bundle gems for the local environment. Make sure to
# put test-only gems in this group so their generators
# and rake tasks are available in development mode:
# group :development, :test do
#   gem 'webrat'
# end

# Gems for Passenger
gem 'passenger'
gem 'sqlite3'

group :production do
  gem 'newrelic_rpm'
  gem 'newrelic-rake'
end

group :development, :test do
  gem 'rspec-rails', '~> 3.1'
  gem 'factory_bot_rails', '~> 4.7'
  gem 'faker', '~> 1.6'
  gem 'watchr'
  gem 'database_cleaner'
  end

group :development do
  gem 'ruby-debug-ide'
end

group :test do
  gem 'rake'
  gem 'rspec-sidekiq'
end
