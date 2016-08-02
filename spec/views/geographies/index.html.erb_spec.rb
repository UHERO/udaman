require 'rails_helper'

RSpec.describe "geographies/index", type: :view do
  before(:each) do
    assign(:geographies, [
      Geography.create!(
        :fips => "Fips",
        :name => "Name",
        :handle => "Handle"
      ),
      Geography.create!(
        :fips => "Fips",
        :name => "Name",
        :handle => "Handle"
      )
    ])
  end

  it "renders a list of geographies" do
    render
    assert_select "tr>td", :text => "Fips".to_s, :count => 2
    assert_select "tr>td", :text => "Name".to_s, :count => 2
    assert_select "tr>td", :text => "Handle".to_s, :count => 2
  end
end
