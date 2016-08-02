require "rails_helper"

RSpec.describe ApiUsersController, type: :routing do
  describe "routing" do

    it "routes to #index" do
      expect(:get => "/api_users").to route_to("api_users#index")
    end

    it "routes to #new" do
      expect(:get => "/api_users/new").to route_to("api_users#new")
    end

    it "routes to #show" do
      expect(:get => "/api_users/1").to route_to("api_users#show", :id => "1")
    end

    it "routes to #edit" do
      expect(:get => "/api_users/1/edit").to route_to("api_users#edit", :id => "1")
    end

    it "routes to #create" do
      expect(:post => "/api_users").to route_to("api_users#create")
    end

    it "routes to #update via PUT" do
      expect(:put => "/api_users/1").to route_to("api_users#update", :id => "1")
    end

    it "routes to #update via PATCH" do
      expect(:patch => "/api_users/1").to route_to("api_users#update", :id => "1")
    end

    it "routes to #destroy" do
      expect(:delete => "/api_users/1").to route_to("api_users#destroy", :id => "1")
    end

  end
end
