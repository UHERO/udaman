require 'rails_helper'

RSpec.describe "units/new", type: :view do
  before(:each) do
    assign(:unit, Unit.new(
      :short_label => "MyString",
      :long_label => "MyString"
    ))
  end

  it "renders new unit form" do
    render

    assert_select "form[action=?][method=?]", units_path, "post" do

      assert_select "input#unit_short_label[name=?]", "unit[short_label]"

      assert_select "input#unit_long_label[name=?]", "unit[long_label]"
    end
  end
end
