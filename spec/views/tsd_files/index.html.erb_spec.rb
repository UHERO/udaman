require 'rails_helper'

RSpec.describe "tsd_files/index", type: :view do
  before(:each) do
    assign(:tsd_files, [
      TsdFile.create!(
        :path => "Path",
        :latest_forecast => false
      ),
      TsdFile.create!(
        :path => "Path",
        :latest_forecast => false
      )
    ])
  end

  it "renders a list of tsd_files" do
    render
    assert_select "tr>td", :text => "Path".to_s, :count => 2
    assert_select "tr>td", :text => false.to_s, :count => 2
  end
end
