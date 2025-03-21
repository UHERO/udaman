require 'spec_helper'

describe DashboardsController do

  describe "GET 'index'" do
    xit "should be successful" do
      get :index, params: {}
      response.should be_success
    end
  end
end
