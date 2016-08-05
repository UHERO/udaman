require 'rails_helper'

RSpec.describe "api_users/new", type: :view do
  before(:each) do
    assign(:api_user, ApiUser.new(
      :key => "MyString",
      :email => "MyString",
      :name => "MyString"
    ))
  end

  it "renders new api_user form" do
    render

    assert_select "form[action=?][method=?]", api_users_path, "post" do

      assert_select "input#api_user_key[name=?]", "api_user[key]"

      assert_select "input#api_user_email[name=?]", "api_user[email]"

      assert_select "input#api_user_name[name=?]", "api_user[name]"
    end
  end
end
