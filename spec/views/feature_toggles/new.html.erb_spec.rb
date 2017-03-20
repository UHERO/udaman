require 'rails_helper'

RSpec.describe "feature_toggles/new", type: :view do
  before(:each) do
    assign(:feature_toggle, FeatureToggle.new(
      :name => "MyString",
      :description => "MyString",
      :status => false
    ))
  end

  it "renders new feature_toggle form" do
    render

    assert_select "form[action=?][method=?]", feature_toggles_path, "post" do

      assert_select "input#feature_toggle_name[name=?]", "feature_toggle[name]"

      assert_select "input#feature_toggle_description[name=?]", "feature_toggle[description]"

      assert_select "input#feature_toggle_status[name=?]", "feature_toggle[status]"
    end
  end
end
