require 'rails_helper'

RSpec.describe "ApiUsers", type: :request do
  describe "GET /api_users" do
    it "works! (now write some real specs)" do
      get api_users_path
      expect(response).to have_http_status(200)
    end
  end
end
