require 'rails_helper'

RSpec.describe "user_feedbacks/index", type: :view do
  before(:each) do
    assign(:user_feedbacks, [
      UserFeedback.create!(
        :name => "Name",
        :email => "Email",
        :feedback => "MyText",
        :notes => "MyText",
        :resolved => false
      ),
      UserFeedback.create!(
        :name => "Name",
        :email => "Email",
        :feedback => "MyText",
        :notes => "MyText",
        :resolved => false
      )
    ])
  end

  xit "renders a list of user_feedbacks" do
    render
    assert_select "tr>td", :text => "Name".to_s, :count => 2
    assert_select "tr>td", :text => "Email".to_s, :count => 2
    assert_select "tr>td", :text => "MyText".to_s, :count => 2
    assert_select "tr>td", :text => "MyText".to_s, :count => 2
    assert_select "tr>td", :text => false.to_s, :count => 2
  end
end
