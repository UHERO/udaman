# spec/support/series_test_helper.rb

module SeriesTestHelper
  # Helper method to build a new series with xseries for testing
  def build_new_series_with_xseries(universe = "UHERO")
    # Create a new series instance with required fields
    series =
      Series.new(universe: universe, dataPortalName: "Test Series", decimals: 1)

    # Build the associated xseries with required fields
    series.build_xseries(
      percent: false,
      seasonal_adjustment: "adjusted_seasonally_adjusted",
      frequency_transform: "average",
      restricted: false
    )

    series
  end

  RSpec.configure { |config| config.include SeriesTestHelper }
  # Helper to create a valid series with standard associations
  def create_standard_series(attributes = {})
    series = build_standard_series(attributes)
    series.save!
    series
  end

  private

  def find_or_create_geography(universe, handle, display_name)
    Geography.find_by(universe: universe, handle: handle) ||
      Geography.create!(
        universe: universe,
        handle: handle,
        display_name: display_name
      )
  end

  def find_or_create_unit(universe, short_label, long_label)
    Unit.find_by(universe: universe, short_label: short_label) ||
      Unit.create!(
        universe: universe,
        short_label: short_label,
        long_label: long_label
      )
  end

  def find_or_create_source(universe, description)
    Source.find_by(universe: universe, description: description) ||
      Source.create!(universe: universe, description: description)
  end
end
