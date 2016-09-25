require 'rails_helper'

RSpec.describe "categories/index", type: :view do
  before(:each) do
    assign(:category_roots, [
      Category.create!(
        :name => "Name",
        :parent_id => nil,
        :data_list_id => 3
      ),
      Category.create!(
        :name => "Name",
        :parent_id => nil,
        :data_list_id => 3
      )
    ])
  end

  it "renders a list of categories" do
    render
    assert_select "ul>li>strong", :text => "Name".to_s, :count => 2
  end
end
