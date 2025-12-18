require 'rails_helper'

RSpec.describe "source_details/show", type: :view do
  before(:each) do
    @source_detail = assign(:source_detail, SourceDetail.create!(
      :description => "MyText"
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/MyText/)
  end
end
