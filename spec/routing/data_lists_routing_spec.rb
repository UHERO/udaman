require "spec_helper"

describe DataListsController do
  describe "routing" do

    xit "routes to #index" do
      get("/data_lists").should route_to("data_lists#index")
    end

    xit "routes to #new" do
      get("/data_lists/new").should route_to("data_lists#new")
    end

    xit "routes to #show" do
      get("/data_lists/1").should route_to("data_lists#show", :id => "1")
    end

    xit "routes to #edit" do
      get("/data_lists/1/edit").should route_to("data_lists#edit", :id => "1")
    end

    xit "routes to #create" do
      post("/data_lists").should route_to("data_lists#create")
    end

    xit "routes to #update" do
      put("/data_lists/1").should route_to("data_lists#update", :id => "1")
    end

    xit "routes to #destroy" do
      delete("/data_lists/1").should route_to("data_lists#destroy", :id => "1")
    end

  end
end
