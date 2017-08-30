require 'rails_helper'

RSpec.describe "categories/new", type: :view do
  before(:each) do
    @data_list = DataList.create!(name: 'MyDL') rescue nil
    assign(:category, Category.new(
      :name => "MyString",
      :parent_id => nil,
      :data_list_id => @data_list.id
    ))
  end

  it "renders new category form" do
    render

    assert_select "form[action=?][method=?]", categories_path, "post" do

      assert_select "input#category_name[name=?]", "category[name]"

      assert_select "select#category_parent_id[name=?]", "category[parent_id]"

      assert_select "select#category_data_list_id[name=?]", "category[data_list_id]"
    end
  end
end
