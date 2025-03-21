require "rails_helper"

RSpec.describe SourceDetailsController, type: :routing do
  describe "routing" do

    it "routes to #index" do
      expect(:get => "/source_details").to route_to("source_details#index")
    end

    it "routes to #new" do
      expect(:get => "/source_details/new").to route_to("source_details#new")
    end

    it "routes to #show" do
      expect(:get => "/source_details/1").to route_to("source_details#show", :id => "1")
    end

    it "routes to #edit" do
      expect(:get => "/source_details/1/edit").to route_to("source_details#edit", :id => "1")
    end

    it "routes to #create" do
      expect(:post => "/source_details").to route_to("source_details#create")
    end

    it "routes to #update via PUT" do
      expect(:put => "/source_details/1").to route_to("source_details#update", :id => "1")
    end

    it "routes to #update via PATCH" do
      expect(:patch => "/source_details/1").to route_to("source_details#update", :id => "1")
    end

    it "routes to #destroy" do
      expect(:delete => "/source_details/1").to route_to("source_details#destroy", :id => "1")
    end

  end
end
