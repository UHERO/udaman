require 'rails_helper'

RSpec.describe "FeatureToggles", type: :request do
  describe "GET /feature_toggles" do
    xit "works! (now write some real specs)" do
      get feature_toggles_path
      expect(response).to have_http_status(200)
    end
  end
end
