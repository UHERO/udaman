require 'rails_helper'

RSpec.describe "categories/show", type: :view do
  before(:each) do
    @data_list = DataList.create!(name: 'MyDL') rescue nil
    @category = assign(:category, Category.create!(
      :name => "Name",
      :parent => nil,
      :data_list_id => @data_list.id
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Name/)
    expect(rendered).to match(/#{@data_list.id}/)
  end
end
