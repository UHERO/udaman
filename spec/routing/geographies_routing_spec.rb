require "rails_helper"

RSpec.describe GeographiesController, type: :routing do
  describe "routing" do

    it "routes to #index" do
      expect(:get => "/geographies").to route_to("geographies#index")
    end

    it "routes to #new" do
      expect(:get => "/geographies/new").to route_to("geographies#new")
    end

    it "routes to #show" do
      expect(:get => "/geographies/1").to route_to("geographies#show", :id => "1")
    end

    it "routes to #edit" do
      expect(:get => "/geographies/1/edit").to route_to("geographies#edit", :id => "1")
    end

    it "routes to #create" do
      expect(:post => "/geographies").to route_to("geographies#create")
    end

    it "routes to #update via PUT" do
      expect(:put => "/geographies/1").to route_to("geographies#update", :id => "1")
    end

    it "routes to #update via PATCH" do
      expect(:patch => "/geographies/1").to route_to("geographies#update", :id => "1")
    end

    it "routes to #destroy" do
      expect(:delete => "/geographies/1").to route_to("geographies#destroy", :id => "1")
    end

  end
end
