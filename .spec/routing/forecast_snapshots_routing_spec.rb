require "rails_helper"

RSpec.describe ForecastSnapshotsController, type: :routing do
  describe "routing" do

    it "routes to #index" do
      expect(:get => "/forecast_snapshots").to route_to("forecast_snapshots#index")
    end

    it "routes to #new" do
      expect(:get => "/forecast_snapshots/new").to route_to("forecast_snapshots#new")
    end

    it "routes to #show" do
      expect(:get => "/forecast_snapshots/1").to route_to("forecast_snapshots#show", :id => "1")
    end

    it "routes to #edit" do
      expect(:get => "/forecast_snapshots/1/edit").to route_to("forecast_snapshots#edit", :id => "1")
    end

    it "routes to #create" do
      expect(:post => "/forecast_snapshots").to route_to("forecast_snapshots#create")
    end

    it "routes to #update via PUT" do
      expect(:put => "/forecast_snapshots/1").to route_to("forecast_snapshots#update", :id => "1")
    end

    it "routes to #update via PATCH" do
      expect(:patch => "/forecast_snapshots/1").to route_to("forecast_snapshots#update", :id => "1")
    end

    it "routes to #destroy" do
      expect(:delete => "/forecast_snapshots/1").to route_to("forecast_snapshots#destroy", :id => "1")
    end

  end
end
