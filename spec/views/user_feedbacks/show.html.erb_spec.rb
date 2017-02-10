require 'rails_helper'

RSpec.describe "user_feedbacks/show", type: :view do
  before(:each) do
    @user_feedback = assign(:user_feedback, UserFeedback.create!(
      :name => "Name",
      :email => "Email",
      :feedback => "MyText",
      :notes => "MyText",
      :resolved => false
    ))
  end

  it "renders attributes in <p>" do
    render
    expect(rendered).to match(/Name/)
    expect(rendered).to match(/Email/)
    expect(rendered).to match(/MyText/)
    expect(rendered).to match(/MyText/)
    expect(rendered).to match(/false/)
  end
end
