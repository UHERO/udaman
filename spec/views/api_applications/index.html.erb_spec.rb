require 'rails_helper'

RSpec.describe "api_applications/index", type: :view do
  before(:each) do
    assign(:api_applications, [
      ApiApplication.create!(
        :name => "Name1",
        :hostname => "Hostname",
        :api_key => "Key"
      ),
      ApiApplication.create!(
        :name => "Name2",
        :hostname => "Hostname",
        :api_key => "Key"
      )
    ])
  end

  it "renders a list of api_applications" do
    render
    assert_select "tr>td", :text => "Name1".to_s, :count => 1
    assert_select "tr>td", :text => "Name2".to_s, :count => 1
    assert_select "tr>td", :text => "Hostname".to_s, :count => 2
    assert_select "tr>td", :text => "Key".to_s, :count => 2
  end
end
