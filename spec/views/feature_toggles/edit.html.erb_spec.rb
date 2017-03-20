require 'rails_helper'

RSpec.describe "feature_toggles/edit", type: :view do
  before(:each) do
    @feature_toggle = assign(:feature_toggle, FeatureToggle.create!(
      :name => "MyString",
      :description => "MyString",
      :status => false
    ))
  end

  it "renders the edit feature_toggle form" do
    render

    assert_select "form[action=?][method=?]", feature_toggle_path(@feature_toggle), "post" do

      assert_select "input#feature_toggle_status[name=?]", "feature_toggle[status]"
    end
  end
end
