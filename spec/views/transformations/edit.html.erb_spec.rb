require 'rails_helper'

RSpec.describe "transformations/edit", type: :view do
  before(:each) do
    @transformation = assign(:transformation, Transformation.create!(
      :key => "MyString",
      :description => "MyString",
      :formula => "MyString"
    ))
  end

  it "renders the edit transformation form" do
    render

    assert_select "form[action=?][method=?]", transformation_path(@transformation), "post" do

      assert_select "input#transformation_key[name=?]", "transformation[key]"

      assert_select "input#transformation_description[name=?]", "transformation[description]"

      assert_select "input#transformation_formula[name=?]", "transformation[formula]"
    end
  end
end
