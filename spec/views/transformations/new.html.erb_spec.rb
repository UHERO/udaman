require 'rails_helper'

RSpec.describe "transformations/new", type: :view do
  before(:each) do
    assign(:transformation, Transformation.new(
      :key => "MyString",
      :description => "MyString",
      :formula => "MyString"
    ))
  end

  it "renders new transformation form" do
    render

    assert_select "form[action=?][method=?]", transformations_path, "post" do

      assert_select "input#transformation_key[name=?]", "transformation[key]"

      assert_select "input#transformation_description[name=?]", "transformation[description]"

      assert_select "input#transformation_formula[name=?]", "transformation[formula]"
    end
  end
end
