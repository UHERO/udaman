require 'rails_helper'

RSpec.describe DataPointsController, :type => :controller do

  describe "GET show" do
    xit "returns http success" do
      get :show, params: {}
      expect(response).to be_success
    end
  end

end
