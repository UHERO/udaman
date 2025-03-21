require "rails_helper"

RSpec.describe FeatureTogglesController, type: :routing do
  describe "routing" do

    it "routes to #index" do
      expect(:get => "/feature_toggles").to route_to("feature_toggles#index")
    end

    it "routes to #new" do
      expect(:get => "/feature_toggles/new").to route_to("feature_toggles#new")
    end

    it "routes to #show" do
      expect(:get => "/feature_toggles/1").to route_to("feature_toggles#show", :id => "1")
    end

    it "routes to #edit" do
      expect(:get => "/feature_toggles/1/edit").to route_to("feature_toggles#edit", :id => "1")
    end

    it "routes to #create" do
      expect(:post => "/feature_toggles").to route_to("feature_toggles#create")
    end

    it "routes to #update via PUT" do
      expect(:put => "/feature_toggles/1").to route_to("feature_toggles#update", :id => "1")
    end

    it "routes to #update via PATCH" do
      expect(:patch => "/feature_toggles/1").to route_to("feature_toggles#update", :id => "1")
    end

    it "routes to #destroy" do
      expect(:delete => "/feature_toggles/1").to route_to("feature_toggles#destroy", :id => "1")
    end

  end
end
