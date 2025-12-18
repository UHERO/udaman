require "spec_helper"

describe SeriesController do
  describe "routing" do

    xit "routes to #index" do
      get("/series").should route_to("series#index")
    end

    xit "routes to #new" do
      get("/series/new").should route_to("series#new")
    end

    xit "routes to #show" do
      get("/series/1").should route_to("series#show", :id => "1")
    end

    xit "routes to #edit" do
      get("/series/1/edit").should route_to("series#edit", :id => "1")
    end

    xit "routes to #create" do
      post("/series").should route_to("series#create")
    end

    xit "routes to #update" do
      put("/series/1").should route_to("series#update", :id => "1")
    end

    xit "routes to #destroy" do
      delete("/series/1").should route_to("series#destroy", :id => "1")
    end

  end
end
