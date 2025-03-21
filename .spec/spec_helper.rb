# spec_helper.rb
RSpec.configure do |config|
  # Mock framework configuration
  config.mock_with :rspec

  # Expectations configuration
  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  # Mocks configuration
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end

  # Shared context metadata
  config.shared_context_metadata_behavior = :apply_to_host_groups

  # Use random order for tests
  config.order = :random
end
