require 'rails_helper'

RSpec.describe "api_applications/new", type: :view do
  before(:each) do
    assign(:api_application, ApiApplication.new(
      :name => "MyString",
      :hostname => "MyString",
      :key => "MyString"
    ))
  end

  it "renders new api_application form" do
    render

    assert_select "form[action=?][method=?]", api_applications_path, "post" do

      assert_select "input#api_application_name[name=?]", "api_application[name]"

      assert_select "input#api_application_hostname[name=?]", "api_application[hostname]"

      assert_select "input#api_application_key[name=?]", "api_application[key]"
    end
  end
end
