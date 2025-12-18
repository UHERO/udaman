require 'rails_helper'

RSpec.describe "geographies/edit", type: :view do
  before(:each) do
    @geography = assign(:geography, Geography.create!(
      :fips => "MyString",
      :display_name => "MyString",
      :display_name_short => "MyString",
      :handle => "MyString"
    ))
  end

  it "renders the edit geography form" do
    render

    assert_select "form[action=?][method=?]", geography_path(@geography), "post" do

      assert_select "input#geography_fips[name=?]", "geography[fips]"

      assert_select "input#geography_display_name[name=?]", "geography[display_name]"

      assert_select "input#geography_display_name_short[name=?]", "geography[display_name_short]"

      assert_select "input#geography_handle[name=?]", "geography[handle]"
    end
  end
end
