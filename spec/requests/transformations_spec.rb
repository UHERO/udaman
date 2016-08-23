require 'rails_helper'

RSpec.describe "Transformations", type: :request do
  describe "GET /transformations" do
    it "works! (now write some real specs)" do
      get transformations_path
      expect(response).to have_http_status(200)
    end
  end
end
