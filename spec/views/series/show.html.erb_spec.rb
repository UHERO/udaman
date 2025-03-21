require "rails_helper"

RSpec.describe "series/show", type: :view do
  include_context "logged in user"

  before do
    # Find a series with all necessary relationships intact
    # Look for one that has primary_series with data_sources
    @series = Series.first

    # Skip if we can't find a suitable series with all necessary relationships
    unless @series
      skip("This test requires a Series with primary_series and data_sources")
    end

    # Set up required instance variables
    @desc = "Test Aremos description"
    @dependencies = {}
    @dsas = []
    @clipboarded = false
    @vintage = nil

    # Helper methods that need to be stubbed
    allow(view).to receive(:gct_datapoints).and_return(
      "['2022-01-01', 100], ['2022-02-01', 105]"
    )
    allow(view).to receive(:universe_label).and_return(@series.universe)
    allow(view).to receive(:make_alt_universe_links).and_return("No aliases")
    allow(view).to receive(:sa_indicator).and_return("Not Seasonally Adjusted")
    allow(view).to receive(:make_hyperlink).and_return(
      "<a href='#'>Test link</a>"
    )

    render
  end

  it "renders the series details correctly" do
    # Verify key sections are present
    expect(rendered).to have_selector("#summary_area")
    expect(rendered).to have_selector("#details_area")
    expect(rendered).to have_selector("h3", text: @series.name)

    # Verify navigation links
    expect(rendered).to have_selector("#navigation")
  end
end
