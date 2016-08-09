require "rails_helper"

RSpec.describe TransformationsController, type: :routing do
  describe "routing" do

    it "routes to #index" do
      expect(:get => "/transformations").to route_to("transformations#index")
    end

    it "routes to #new" do
      expect(:get => "/transformations/new").to route_to("transformations#new")
    end

    it "routes to #show" do
      expect(:get => "/transformations/1").to route_to("transformations#show", :id => "1")
    end

    it "routes to #edit" do
      expect(:get => "/transformations/1/edit").to route_to("transformations#edit", :id => "1")
    end

    it "routes to #create" do
      expect(:post => "/transformations").to route_to("transformations#create")
    end

    it "routes to #update via PUT" do
      expect(:put => "/transformations/1").to route_to("transformations#update", :id => "1")
    end

    it "routes to #update via PATCH" do
      expect(:patch => "/transformations/1").to route_to("transformations#update", :id => "1")
    end

    it "routes to #destroy" do
      expect(:delete => "/transformations/1").to route_to("transformations#destroy", :id => "1")
    end

  end
end
