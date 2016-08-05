require 'rails_helper'

RSpec.describe "api_users/edit", type: :view do
  before(:each) do
    @api_user = assign(:api_user, ApiUser.create!(
      :key => "MyString",
      :email => "MyString",
      :name => "MyString"
    ))
  end

  it "renders the edit api_user form" do
    render

    assert_select "form[action=?][method=?]", api_user_path(@api_user), "post" do

      assert_select "input#api_user_key[name=?]", "api_user[key]"

      assert_select "input#api_user_email[name=?]", "api_user[email]"

      assert_select "input#api_user_name[name=?]", "api_user[name]"
    end
  end
end
