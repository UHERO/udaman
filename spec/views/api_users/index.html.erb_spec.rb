require 'rails_helper'

RSpec.describe "api_users/index", type: :view do
  before(:each) do
    assign(:api_users, [
      ApiUser.create!(
        :key => "Key",
        :email => "Email",
        :name => "Name"
      ),
      ApiUser.create!(
        :key => "Key",
        :email => "Email",
        :name => "Name"
      )
    ])
  end

  it "renders a list of api_users" do
    render
    assert_select "tr>td", :text => "Key".to_s, :count => 2
    assert_select "tr>td", :text => "Email".to_s, :count => 2
    assert_select "tr>td", :text => "Name".to_s, :count => 2
  end
end
