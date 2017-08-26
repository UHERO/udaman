require 'rails_helper'

RSpec.describe "categories/edit", type: :view do
  before(:each) do
    @data_list = DataList.create!(name: 'MyDL') rescue nil
    @category = assign(:category, Category.create!(
      :name => "MyString",
      :parent_id => nil,
      :data_list_id => @data_list.id
    ))
  end

  it "renders the edit category form" do
    render

    assert_select "form[action=?][method=?]", category_path(@category), "post" do

      assert_select "input#category_name[name=?]", "category[name]"

      assert_select "select#category_parent_id[name=?]", "category[parent_id]"

      assert_select "select#category_data_list_id[name=?]", "category[data_list_id]"
    end
  end
end
