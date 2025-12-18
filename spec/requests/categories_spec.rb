require 'rails_helper'

RSpec.describe "Categories", type: :request do
  before(:each) do
  end
  describe "GET /categories" do
    xit "works! (now write some real specs)" do
      get categories_path
      expect(response).to have_http_status(200)
    end
  end
end
