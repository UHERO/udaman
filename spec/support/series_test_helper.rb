# spec/support/series_test_helper.rb

module SeriesTestHelper
  # Core setup method that creates or finds standard test objects
  def setup_standard_objects
    @geography = find_or_create_geography("UHERO", "HI", "Hawaii")
    @unit = find_or_create_unit("UHERO", "Test", "Test Unit")
    @source = find_or_create_source("UHERO", "Test Source")
    @xseries = create(:xseries)
  end

  # Helper to build a valid series with standard associations
  def build_standard_series(attributes = {})
    setup_standard_objects unless @geography && @unit && @source && @xseries

    defaults = {
      universe: "UHERO",
      name: "TEST@HI.A",
      dataPortalName: "Test Series",
      decimals: 1,
      scratch: 11_011, # Skip validation
      xseries: @xseries,
      geography_id: @geography.id,
      unit_id: @unit.id,
      source_id: @source.id
    }

    Series.new(defaults.merge(attributes))
  end

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
