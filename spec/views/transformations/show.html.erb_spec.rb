require 'rails_helper'

RSpec.describe "transformations/show", type: :view do
  before(:each) do
    @transformation = assign(:transformation, Transformation.create!(
      :key => "Key",
      :description => "Description",
      :formula => "Formula"
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Key/)
    expect(rendered).to match(/Description/)
    expect(rendered).to match(/Formula/)
  end
end
