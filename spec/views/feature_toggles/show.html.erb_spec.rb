require 'rails_helper'

RSpec.describe "feature_toggles/show", type: :view do
  before(:each) do
    @feature_toggle = assign(:feature_toggle, FeatureToggle.create!(
      :name => "Name",
      :description => "Description",
      :status => false
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Name/)
    expect(rendered).to match(/Description/)
    expect(rendered).to match(/false/)
  end
end
