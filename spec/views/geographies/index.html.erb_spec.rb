require 'rails_helper'

RSpec.describe "geographies/index", type: :view do
  before(:each) do
    assign(:geographies, [
      Geography.create!(
        :fips => "Fips",
        :display_name => "Display Name",
        :display_name_short => "Display Name Short",
        :handle => "Handle1"
      ),
      Geography.create!(
        :fips => "Fips",
        :display_name => "Display Name",
        :display_name_short => "Display Name Short",
        :handle => "Handle2"
      )
    ])
  end

  it "renders a list of geographies" do
    render
    assert_select "tr>td", :text => "Fips".to_s, :count => 2
    assert_select "tr>td", :text => "Display Name".to_s, :count => 2
    assert_select "tr>td", :text => "Display Name Short".to_s, :count => 2
    assert_select "tr>td", :text => "Handle1".to_s, :count => 1
    assert_select "tr>td", :text => "Handle2".to_s, :count => 1
  end
end
