require 'rails_helper'

RSpec.describe "sources/index", type: :view do
  before(:each) do
    assign(:sources, [
      Source.create!(
        :description => "Description",
        :link => "http://link.gov"
      ),
      Source.create!(
        :description => "Description",
        :link => "http://link.gov"
      )
    ])
  end

  it "renders a list of sources" do
    render
    assert_select "tr>td", :text => "Description".to_s, :count => 2
    assert_select "tr>td", :text => "http://link.gov".to_s, :count => 2
  end
end
