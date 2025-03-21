require "rails_helper"

require "rails_helper"

RSpec.describe "series/index", type: :view do
  include_context "logged in user"

  before do
    # Fetch a limited number of series from the database
    series_from_db = Series.limit(20)

    # Assign them to the variables expected by the view
    assign(:all_series, series_from_db)
    assign(:search_string, nil)

    render
  end

  it "renders the basic structure of the page" do
    expect(rendered).to have_selector("div#summary_area")
    expect(rendered).to have_selector("div#details_area")
    expect(rendered).to have_selector("h1", text: "Data Series")

    # Check for some of the links
    expect(rendered).to have_link("Create UHERO Series")
    expect(rendered).to have_link("Create COH Series")

    # If series exist, we shouldn't see the "No results" message
    if Series.count > 0
      expect(rendered).not_to have_content("No results.")
      # Optionally check for the count display
      expect(rendered).to have_selector("h2", text: /Total:/)
    else
      expect(rendered).to have_content("No results.")
    end
  end
end
