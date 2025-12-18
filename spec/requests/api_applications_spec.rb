require 'rails_helper'

RSpec.describe "ApiApplications", type: :request do
  before(:each) do
  end
  describe "GET /api_applications" do
    xit "works! (now write some real specs)" do
      get api_applications_path
      expect(response).to have_http_status(200)
    end
  end
end
