require 'rails_helper'

RSpec.describe "api_users/show", type: :view do
  before(:each) do
    @api_user = assign(:api_user, ApiUser.create!(
      :key => "Key",
      :email => "Email",
      :name => "Name"
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Key/)
    expect(rendered).to match(/Email/)
    expect(rendered).to match(/Name/)
  end
end
