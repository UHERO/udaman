require 'rails_helper'

RSpec.describe "source_details/index", type: :view do
  before(:each) do
    assign(:source_details, [
      SourceDetail.create!(
        :description => "MyText"
      ),
      SourceDetail.create!(
        :description => "MyText"
      )
    ])
  end

  it "renders a list of source_details" do
    render
    assert_select "tr>td", :text => "MyText".to_s, :count => 2
  end
end
