require 'rails_helper'

RSpec.describe "TsdFiles", type: :request do
  describe "GET /tsd_files" do
    it "works! (now write some real specs)" do
      get tsd_files_path
      expect(response).to have_http_status(200)
    end
  end
end
