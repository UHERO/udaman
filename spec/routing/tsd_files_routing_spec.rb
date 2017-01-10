require "rails_helper"

RSpec.describe TsdFilesController, type: :routing do
  describe "routing" do

    it "routes to #index" do
      expect(:get => "/tsd_files").to route_to("tsd_files#index")
    end

    it "routes to #new" do
      expect(:get => "/tsd_files/new").to route_to("tsd_files#new")
    end

    it "routes to #show" do
      expect(:get => "/tsd_files/1").to route_to("tsd_files#show", :id => "1")
    end

    it "routes to #edit" do
      expect(:get => "/tsd_files/1/edit").to route_to("tsd_files#edit", :id => "1")
    end

    it "routes to #create" do
      expect(:post => "/tsd_files").to route_to("tsd_files#create")
    end

    it "routes to #update via PUT" do
      expect(:put => "/tsd_files/1").to route_to("tsd_files#update", :id => "1")
    end

    it "routes to #update via PATCH" do
      expect(:patch => "/tsd_files/1").to route_to("tsd_files#update", :id => "1")
    end

    it "routes to #destroy" do
      expect(:delete => "/tsd_files/1").to route_to("tsd_files#destroy", :id => "1")
    end

  end
end
