require 'rails_helper'

RSpec.describe "forecast_snapshots/show", type: :view do
  before(:each) do
    @forecast_snapshot = assign(:forecast_snapshot, ForecastSnapshot.create!(
      :name => "Name",
      :version => "Version",
      :comments => "MyText",
      :published => false
    ))
  end

  xit "renders attributes in <p>" do
    render
    expect(rendered).to match(/Name/)
    expect(rendered).to match(/Version/)
    expect(rendered).to match(/MyText/)
    expect(rendered).to match(/false/)
  end
end
