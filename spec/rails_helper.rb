# rails_helper.rb
require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require File.expand_path('../../config/environment', __FILE__)
abort("The Rails environment is running in production mode!") if Rails.env.production?

require 'rspec/rails'
require 'devise'
require 'database_cleaner/active_record'

# Load support files
Dir[Rails.root.join('spec', 'support', '**', '*.rb')].sort.each { |f| require f }

# Check for pending migrations
ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  # Fixture configuration
  config.fixture_path = "#{::Rails.root}/spec/fixtures"

  # Transaction configuration
  config.use_transactional_fixtures = true

  # Filter line backtraces
  config.filter_rails_from_backtrace!

  # Infer spec types from file location
  config.infer_spec_type_from_file_location!

  # Include Devise helpers
  config.include Devise::Test::ControllerHelpers, type: :controller

  # Include FactoryBot methods
  config.include FactoryBot::Syntax::Methods

  # Database cleaner configuration - using transaction strategy
  config.before(:each) do
    DatabaseCleaner.strategy = :transaction
    DatabaseCleaner.start
  end

  config.after(:each) do
    DatabaseCleaner.clean
  end
end
