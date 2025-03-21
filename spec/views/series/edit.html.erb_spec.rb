require "rails_helper"

RSpec.describe "series/edit", type: :view do
  include_context "logged in user"

  before do
    # Use an existing series from the database
    @series = Series.first
    unless @series
      skip("This test requires at least one Series in the database")
    end

    # Set up the required instance variables using existing data
    @all_geos = Geography.all
    @all_units = Unit.all
    @all_sources = Source.all
    @all_details = SourceDetail.all

    # Skip if any required data is missing
    if @all_geos.empty? || @all_units.empty? || @all_sources.empty? ||
         @all_details.empty?
      skip("This test requires Geography, Unit, Source and SourceDetail data")
    end

    # Additional variables needed by the form
    @meta_update = false
    @add2meas = nil

    render
  end

  it "renders the edit series form" do
    # Check for the heading
    expect(rendered).to have_selector("h1", text: /Editing series/)
    expect(rendered).to have_link(@series.name)

    # Check for form structure
    expect(rendered).to have_selector("form")

    # Check for required fields
    expect(rendered).to have_field("series[dataPortalName]")
    expect(rendered).to have_field("series[description]")
    expect(rendered).to have_field("series[decimals]")

    # Check for select fields
    expect(rendered).to have_select("series[unit_id]")
    expect(rendered).to have_select("series[source_id]")

    # Check for the action buttons
    expect(rendered).to have_button("Update Series")
    expect(rendered).to have_link("Cancel")
  end
end
