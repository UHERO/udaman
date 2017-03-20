require 'rails_helper'

RSpec.describe "feature_toggles/index", type: :view do
  before(:each) do
    assign(:feature_toggles, [
      FeatureToggle.create!(
        :name => "Name",
        :description => "Description",
        :status => false
      ),
      FeatureToggle.create!(
        :name => "Name",
        :description => "Description",
        :status => false
      )
    ])
  end

  it "renders a list of feature_toggles" do
    render
    assert_select "tr>td", :text => "Name".to_s, :count => 2
    assert_select "tr>td", :text => "Description".to_s, :count => 2
    assert_select "tr>td", :text => false.to_s, :count => 2
  end
end
