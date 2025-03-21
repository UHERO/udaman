# spec/support/devise_helpers.rb
RSpec.shared_context "logged in user" do
  before do
    user =
      double("User", internal_user?: true, admin_user?: true, dev_user?: true)

    allow(view).to receive(:current_user).and_return(user)
  end
end
