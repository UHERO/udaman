source 'http://rubygems.org'

gem 'rails', '4.2.6'

# Application Monitoring
gem 'newrelic_rpm'

gem 'capistrano-rvm'
gem 'rvm-capistrano'
gem 'capistrano-rails', '~> 1.1'
gem 'capistrano-bundler', '~> 1.1.3'
gem 'capistrano', '~> 3.2.1'
gem 'highline', '~> 1.6.0'
gem 'mysql2', '~> 0.4'
gem 'roo'
gem 'roo-xls'
gem 'httpclient'
gem 'spork', '~> 0.9.0.rc'
gem 'rubyzip', '~> 1.0'
gem 'capybara',  '2.0.3'
gem 'selenium-webdriver'
gem 'watir-webdriver'
gem 'whenever'
gem 'mechanize'
gem 'net-sftp'

# Dependencies related to upgrade to Ruby 2.3.0 and Rails 4.2
#gem 'devise-encryptable', '~> 0.2'
gem 'protected_attributes', '~> 1.1' # http://stackoverflow.com/questions/17371334/how-is-attr-accessible-used-in-rails-4
gem 'sass-rails',   '~> 5.0'
gem 'coffee-rails', '~> 4.1'
gem 'uglifier', '~> 3.0'
gem 'jquery-rails', '~> 4.1'
gem 'jquery-ui-rails', '~> 5.0'
gem 'devise', '~> 4.0.0'

# Deploy with Capistrano
# gem 'capistrano'

# To use debugger (ruby-debug for Ruby 1.8.7+, ruby-debug19 for Ruby 1.9.2+)
# gem 'ruby-debug'
# gem 'ruby-debug19', :require => 'ruby-debug'

# Bundle the extra gems:
# gem 'bj'
gem 'nokogiri'
# gem 'sqlite3-ruby', :require => 'sqlite3'
# gem 'aws-s3', :require => 'aws/s3'

# gems for passenger
gem "passenger"
gem "sqlite3"

# Bundle gems for the local environment. Make sure to
# put test-only gems in this group so their generators
# and rake tasks are available in development mode:
# group :development, :test do
#   gem 'webrat'
# end

group :development, :test do
  gem 'rspec-rails'
  gem 'cucumber-rails', :require => false
  gem 'watchr'
  gem 'database_cleaner'
  gem 'test-unit', '1.2.3'
  # added for deployment process (6/5/2014) JP
end
