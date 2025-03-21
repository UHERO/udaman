require "rails_helper"

RSpec.describe "series/new", type: :view do
  include_context "logged in user"

  before do
    # Create a new series instance
    # @series = Series.where(universe: "UHERO").first
    # Create a new series instance with all required fields
    @series =
      Series.new(
        universe: "UHERO",
        dataPortalName: "Test Series", # Add required dataPortalName
        decimals: 1 # Add required decimals field
      )

    # Build the associated xseries with required fields
    @series.build_xseries(
      percent: false,
      seasonal_adjustment: "seasonally_adjusted",
      frequency_transform: "average",
      restricted: false
    )

    # Set up the required instance variables using existing data
    @universe = "UHERO"
    @all_geos = Geography.all
    @all_units = Unit.all
    @all_sources = Source.all
    @all_details = SourceDetail.all

    # Skip if any required data is missing
    if @all_geos.empty? || @all_units.empty? || @all_sources.empty? ||
         @all_details.empty?
      skip("This test requires Geography, Unit, Source and SourceDetail data")
    end

    # Additional variables that might be needed based on the form
    @meta_update = false
    @add2meas = nil

    render
  end

  it "renders the new series form" do
    puts rendered
    # Check for the heading
    expect(rendered).to have_selector("h1", text: /New series for UHERO/)

    # The note for non-UHERO universes should not appear for UHERO
    expect(rendered).not_to have_content(
      "Note! This screen can only be used when creating a series uniquely for"
    )

    # Check for form structure
    expect(rendered).to have_selector("form")

    # For a new series, we should have the name prefix fields
    expect(rendered).to have_field(nil, id: "series_dataPortalName")
    expect(rendered).to have_select("name_parts[geography_id]")
    expect(rendered).to have_select("name_parts[freq]")

    # Check for required fields
    expect(rendered).to have_field("series[dataPortalName]")
    expect(rendered).to have_field("series[description]")
    expect(rendered).to have_field("series[decimals]")

    # Check for the action buttons
    expect(rendered).to have_button("Create Series")
    expect(rendered).to have_link("Cancel")
  end

  context "when creating a non-UHERO series" do
    before do
      # @series = Series.where(universe: "COH").first
      @series =
        Series.new(
          universe: "COH",
          dataPortalName: "Test Series", # Add required dataPortalName
          decimals: 1 # Add required decimals field
        )

      # Build the associated xseries with required fields
      @series.build_xseries(
        percent: false,
        seasonal_adjustment: "seasonally_adjusted",
        frequency_transform: "average",
        restricted: false
      )

      @universe = "COH"
      @all_geos = Geography.all
      @all_units = Unit.all
      @all_sources = Source.all
      @all_details = SourceDetail.all

      # Skip if any required data is missing (repeating here for the context)
      if @all_geos.empty? || @all_units.empty? || @all_sources.empty? ||
           @all_details.empty?
        skip("This test requires Geography, Unit, Source and SourceDetail data")
      end

      render
    end

    it "displays the note about creating unique series" do
      expect(rendered).to have_selector("h1", text: /New series for COH/)
      expect(rendered).to have_content(
        "Note! This screen can only be used when creating a series uniquely for COH"
      )
      expect(rendered).to have_content(
        "If you need to create an alias of a UHERO"
      )
    end
  end
end
