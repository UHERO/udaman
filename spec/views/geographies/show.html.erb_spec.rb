require 'rails_helper'

RSpec.describe "geographies/show", type: :view do
  before(:each) do
    @geography = assign(:geography, Geography.create!(
      :fips => "Fips",
      :name => "Name",
      :handle => "Handle"
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Fips/)
    expect(rendered).to match(/Name/)
    expect(rendered).to match(/Handle/)
  end
end
