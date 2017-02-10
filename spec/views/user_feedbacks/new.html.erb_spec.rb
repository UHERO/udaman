require 'rails_helper'

RSpec.describe "user_feedbacks/new", type: :view do
  before(:each) do
    assign(:user_feedback, UserFeedback.new(
      :name => "MyString",
      :email => "MyString",
      :feedback => "MyText",
      :notes => "MyText",
      :resolved => false
    ))
  end

  it "renders new user_feedback form" do
    render

    assert_select "form[action=?][method=?]", user_feedbacks_path, "post" do

      assert_select "input#user_feedback_name[name=?]", "user_feedback[name]"

      assert_select "input#user_feedback_email[name=?]", "user_feedback[email]"

      assert_select "textarea#user_feedback_feedback[name=?]", "user_feedback[feedback]"

      assert_select "textarea#user_feedback_notes[name=?]", "user_feedback[notes]"

      assert_select "input#user_feedback_resolved[name=?]", "user_feedback[resolved]"
    end
  end
end
