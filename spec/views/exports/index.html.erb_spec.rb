require 'rails_helper'

RSpec.describe "exports/index", type: :view do
  before(:each) do
    assign(:exports, [
      Export.create!(
        :name => "Name",
        :created_by => 2,
        :updated_by => 3,
        :owned_by => 4
      ),
      Export.create!(
        :name => "Name",
        :created_by => 2,
        :updated_by => 3,
        :owned_by => 4
      )
    ])
  end

  it "renders a list of exports" do
    render
    assert_select "tr>td", :text => "Name".to_s, :count => 2
    assert_select "tr>td", :text => 2.to_s, :count => 2
    assert_select "tr>td", :text => 3.to_s, :count => 2
    assert_select "tr>td", :text => 4.to_s, :count => 2
  end
end
