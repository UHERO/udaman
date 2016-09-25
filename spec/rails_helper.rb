require 'spec_helper'
require 'rspec/rails'
# note: require 'devise' after require 'rspec/rails'
require 'devise'

ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.include Devise::Test::ControllerHelpers, :type => :controller
  config.include FactoryGirl::Syntax::Methods
end