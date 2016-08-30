require 'rails_helper'

RSpec.describe "api_applications/edit", type: :view do
  before(:each) do
    @api_application = assign(:api_application, ApiApplication.create!(
      :name => "MyString",
      :hostname => "MyString",
      :key => "MyString"
    ))
  end

  it "renders the edit api_application form" do
    render

    assert_select "form[action=?][method=?]", api_application_path(@api_application), "post" do

      assert_select "input#api_application_name[name=?]", "api_application[name]"

      assert_select "input#api_application_hostname[name=?]", "api_application[hostname]"

      assert_select "input#api_application_key[name=?]", "api_application[key]"
    end
  end
end
