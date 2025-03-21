require 'rails_helper'

# This spec was generated by rspec-rails when you ran the scaffold generator.
# It demonstrates how one might use RSpec to test the controller code that
# was generated by Rails when you ran the scaffold generator.
#
# It assumes that the implementation code is generated by the rails scaffold
# generator. If you are using any extension libraries to generate different
# controller code, this generated spec may or may not pass.
#
# It only uses APIs available in rails and/or rspec-rails. There are a number
# of tools you can use to make these specs even more expressive, but we're
# sticking to rails and rspec-rails APIs to keep things simple and stable.

RSpec.describe "/series", type: :request do
  
  # This should return the minimal set of attributes required to create a valid
  # Series. As you add validations to Series, be sure to
  # adjust the attributes here as well.
  let(:valid_attributes) {
    skip("Add a hash of attributes valid for your model")
  }

  let(:invalid_attributes) {
    skip("Add a hash of attributes invalid for your model")
  }

  describe "GET /index" do
    it "renders a successful response" do
      Series.create! valid_attributes
      get series_index_url
      expect(response).to be_successful
    end
  end

  describe "GET /show" do
    it "renders a successful response" do
      series = Series.create! valid_attributes
      get series_url(series)
      expect(response).to be_successful
    end
  end

  describe "GET /new" do
    it "renders a successful response" do
      get new_series_url
      expect(response).to be_successful
    end
  end

  describe "GET /edit" do
    it "renders a successful response" do
      series = Series.create! valid_attributes
      get edit_series_url(series)
      expect(response).to be_successful
    end
  end

  describe "POST /create" do
    context "with valid parameters" do
      it "creates a new Series" do
        expect {
          post series_index_url, params: { series: valid_attributes }
        }.to change(Series, :count).by(1)
      end

      it "redirects to the created series" do
        post series_index_url, params: { series: valid_attributes }
        expect(response).to redirect_to(series_url(Series.last))
      end
    end

    context "with invalid parameters" do
      it "does not create a new Series" do
        expect {
          post series_index_url, params: { series: invalid_attributes }
        }.to change(Series, :count).by(0)
      end

      it "renders a successful response (i.e. to display the 'new' template)" do
        post series_index_url, params: { series: invalid_attributes }
        expect(response).to be_successful
      end
    end
  end

  describe "PATCH /update" do
    context "with valid parameters" do
      let(:new_attributes) {
        skip("Add a hash of attributes valid for your model")
      }

      it "updates the requested series" do
        series = Series.create! valid_attributes
        patch series_url(series), params: { series: new_attributes }
        series.reload
        skip("Add assertions for updated state")
      end

      it "redirects to the series" do
        series = Series.create! valid_attributes
        patch series_url(series), params: { series: new_attributes }
        series.reload
        expect(response).to redirect_to(series_url(series))
      end
    end

    context "with invalid parameters" do
      it "renders a successful response (i.e. to display the 'edit' template)" do
        series = Series.create! valid_attributes
        patch series_url(series), params: { series: invalid_attributes }
        expect(response).to be_successful
      end
    end
  end

  describe "DELETE /destroy" do
    it "destroys the requested series" do
      series = Series.create! valid_attributes
      expect {
        delete series_url(series)
      }.to change(Series, :count).by(-1)
    end

    it "redirects to the series list" do
      series = Series.create! valid_attributes
      delete series_url(series)
      expect(response).to redirect_to(series_index_url)
    end
  end
end
