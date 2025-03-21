require 'rails_helper'

RSpec.describe "Geographies", type: :request do
  before(:each) do
  end
  describe "GET /geographies" do
    xit "works! (now write some real specs)" do
      get geographies_path
      expect(response).to have_http_status(200)
    end
  end
end
