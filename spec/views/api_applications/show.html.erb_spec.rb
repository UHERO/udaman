require 'rails_helper'

RSpec.describe "api_applications/show", type: :view do
  before(:each) do
    @api_application = assign(:api_application, ApiApplication.create!(
      :name => "Name",
      :hostname => "Hostname",
      :key => "Key"
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Name/)
    expect(rendered).to match(/Hostname/)
    expect(rendered).to match(/Key/)
  end
end
