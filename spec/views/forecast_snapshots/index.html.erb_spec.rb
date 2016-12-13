require 'rails_helper'

RSpec.describe "forecast_snapshots/index", type: :view do
  before(:each) do
    assign(:forecast_snapshots, [
      ForecastSnapshot.create!(
        :name => "Name",
        :version => "Version",
        :comments => "MyText",
        :published => false
      ),
      ForecastSnapshot.create!(
        :name => "Name",
        :version => "Version",
        :comments => "MyText",
        :published => false
      )
    ])
  end

  it "renders a list of forecast_snapshots" do
    render
    assert_select "tr>td", :text => "Name".to_s, :count => 2
    assert_select "tr>td", :text => "Version".to_s, :count => 2
    assert_select "tr>td", :text => "MyText".to_s, :count => 2
    assert_select "tr>td", :text => false.to_s, :count => 2
  end
end
