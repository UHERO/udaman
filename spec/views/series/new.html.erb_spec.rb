require "rails_helper"

RSpec.describe "series/new", type: :view do
  include_context "logged in user"

  before do
    # simple series is created when form loads (is it deleted if the form is cancelled??)
    @series = build_new_series_with_xseries

    # needed by UI to determine form options
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
    expect(rendered).to have_selector("h1", text: /New series for UHERO/)
    expect(rendered).not_to have_content(
      "Note! This screen can only be used when creating a series uniquely for"
    )

    expect(rendered).to have_selector("form")

    expect(rendered).to have_field(nil, id: "series_dataPortalName")
    expect(rendered).to have_select("name_parts[geography_id]")
    expect(rendered).to have_select("name_parts[freq]")

    expect(rendered).to have_field("series[dataPortalName]")
    expect(rendered).to have_field("series[description]")
    expect(rendered).to have_field("series[decimals]")

    expect(rendered).to have_button("Create Series")
    expect(rendered).to have_link("Cancel")
  end

  context "when creating a non-UHERO series" do
    before do
      @series = build_new_series_with_xseries

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
