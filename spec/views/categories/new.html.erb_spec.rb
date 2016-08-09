require 'rails_helper'

RSpec.describe "categories/new", type: :view do
  before(:each) do
    assign(:category, Category.new(
      :name => "MyString",
      :parent => 1,
      :data_list_id => 1
    ))
  end

  it "renders new category form" do
    render

    assert_select "form[action=?][method=?]", categories_path, "post" do

      assert_select "input#category_name[name=?]", "category[name]"

      assert_select "input#category_parent[name=?]", "category[parent]"

      assert_select "input#category_data_list_id[name=?]", "category[data_list_id]"
    end
  end
end
