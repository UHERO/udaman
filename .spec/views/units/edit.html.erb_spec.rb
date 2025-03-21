require 'rails_helper'

RSpec.describe "units/edit", type: :view do
  before(:each) do
    @unit = assign(:unit, Unit.create!(
      :short_label => "MyString",
      :long_label => "MyString"
    ))
  end

  it "renders the edit unit form" do
    render

    assert_select "form[action=?][method=?]", unit_path(@unit), "post" do

      assert_select "input#unit_short_label[name=?]", "unit[short_label]"

      assert_select "input#unit_long_label[name=?]", "unit[long_label]"
    end
  end
end
