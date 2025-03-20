# spec/support/series_helpers.rb
module SeriesHelpers
  # Create a series with the given name
  def create_series(name)
    parts = Series.parse_name(name)
    geography = Geography.find_by(handle: parts[:geo]) ||
                create(:geography, handle: parts[:geo], universe: "TEST")

    create(:series,
      name: name,
      universe: "TEST",
      geography: geography,
      frequency: parts[:freq_long]
    )
  end
end

RSpec.configure do |config|
  config.include SeriesHelpers
end
