require 'rails_helper'

RSpec.describe "tsd_files/show", type: :view do
  before(:each) do
    @tsd_file = assign(:tsd_file, TsdFile.create!(
      :path => "Path",
      :latest => false
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Path/)
    expect(rendered).to match(/false/)
  end
end
