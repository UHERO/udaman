require 'rails_helper'

RSpec.describe "transformations/index", type: :view do
  before(:each) do
    assign(:transformations, [
      Transformation.create!(
        :key => "Key",
        :description => "Description",
        :formula => "Formula"
      ),
      Transformation.create!(
        :key => "Key",
        :description => "Description",
        :formula => "Formula"
      )
    ])
  end

  it "renders a list of transformations" do
    render
    assert_select "tr>td", :text => "Key".to_s, :count => 2
    assert_select "tr>td", :text => "Description".to_s, :count => 2
    assert_select "tr>td", :text => "Formula".to_s, :count => 2
  end
end
