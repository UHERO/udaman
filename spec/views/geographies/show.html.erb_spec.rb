require 'rails_helper'

RSpec.describe "geographies/show", type: :view do
  before(:each) do
    @geography = assign(:geography, Geography.create!(
      :fips => "Fips",
      :display_name => "Display Name",
      :display_name_short => "Display Name Short",
      :handle => "Handle"
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Fips/)
    expect(rendered).to match(/Display Name/)
    expect(rendered).to match(/Display Name Short/)
    expect(rendered).to match(/Handle/)
  end
end
