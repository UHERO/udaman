require "rails_helper"

RSpec.describe SeriesController, type: :routing do
  describe "routing" do
    it "routes to #index" do
      expect(get: "/series").to route_to("series#index")
    end

    it "routes to #new" do
      expect(get: "/series/new").to route_to("series#new")
    end

    it "routes to #show" do
      expect(get: "/series/1").to route_to("series#show", id: "1")
    end

    it "routes to #edit" do
      expect(get: "/series/1/edit").to route_to("series#edit", id: "1")
    end


    it "routes to #create" do
      expect(post: "/series").to route_to("series#create")
    end

    it "routes to #update via PUT" do
      expect(put: "/series/1").to route_to("series#update", id: "1")
    end

    it "routes to #update via PATCH" do
      expect(patch: "/series/1").to route_to("series#update", id: "1")
    end

    it "routes to #destroy" do
      expect(delete: "/series/1").to route_to("series#destroy", id: "1")
    end
  end
end
