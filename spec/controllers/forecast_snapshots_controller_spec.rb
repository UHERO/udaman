require 'rails_helper'

# This spec was generated by rspec-rails when you ran the scaffold generator.
# It demonstrates how one might use RSpec to specify the controller code that
# was generated by Rails when you ran the scaffold generator.
#
# It assumes that the implementation code is generated by the rails scaffold
# generator.  If you are using any extension libraries to generate different
# controller code, this generated spec may or may not pass.
#
# It only uses APIs available in rails and/or rspec-rails.  There are a number
# of tools you can use to make these specs even more expressive, but we're
# sticking to rails and rspec-rails APIs to keep things simple and stable.
#
# Compared to earlier versions of this generator, there is very limited use of
# stubs and message expectations in this spec.  Stubs are only used when there
# is no simpler way to get a handle on the object needed for the example.
# Message expectations are only used when there is no simpler way to specify
# that an instance is receiving a specific message.

RSpec.describe ForecastSnapshotsController, type: :controller do

  # This should return the minimal set of attributes required to create a valid
  # ForecastSnapshot. As you add validations to ForecastSnapshot, be sure to
  # adjust the attributes here as well.
  let(:valid_attributes) {
    skip("Add a hash of attributes valid for your model")
  }

  let(:invalid_attributes) {
    skip("Add a hash of attributes invalid for your model")
  }

  # This should return the minimal set of values that should be in the session
  # in order to pass any filters (e.g. authentication) defined in
  # ForecastSnapshotsController. Be sure to keep this updated too.
  let(:valid_session) { {} }

  before(:each) do
    @request.env['devise.mapping'] = Devise.mappings[:user]
    user = FactoryBot.create(:user)
    sign_in user
  end

  describe "GET #index" do
    it "assigns all forecast_snapshots as @forecast_snapshots" do
      forecast_snapshot = ForecastSnapshot.create! valid_attributes
      get :index, params: {}, session: valid_session
      expect(assigns(:forecast_snapshots)).to eq([forecast_snapshot])
    end
  end

  describe "GET #show" do
    it "assigns the requested forecast_snapshot as @forecast_snapshot" do
      forecast_snapshot = ForecastSnapshot.create! valid_attributes
      get :show, params: {id: forecast_snapshot.to_param}, session: valid_session
      expect(assigns(:forecast_snapshot)).to eq(forecast_snapshot)
    end
  end

  describe "GET #new" do
    it "assigns a new forecast_snapshot as @forecast_snapshot" do
      get :new, params: {}, session: valid_session
      expect(assigns(:forecast_snapshot)).to be_a_new(ForecastSnapshot)
    end
  end

  describe "GET #edit" do
    it "assigns the requested forecast_snapshot as @forecast_snapshot" do
      forecast_snapshot = ForecastSnapshot.create! valid_attributes
      get :edit, params: {id: forecast_snapshot.to_param}, session: valid_session
      expect(assigns(:forecast_snapshot)).to eq(forecast_snapshot)
    end
  end

  describe "POST #create" do
    context "with valid params" do
      it "creates a new ForecastSnapshot" do
        expect {
          post :create, params: {forecast_snapshot: valid_attributes}, session: valid_session
        }.to change(ForecastSnapshot, :count).by(1)
      end

      it "assigns a newly created forecast_snapshot as @forecast_snapshot" do
        post :create, params: {forecast_snapshot: valid_attributes}, session: valid_session
        expect(assigns(:forecast_snapshot)).to be_a(ForecastSnapshot)
        expect(assigns(:forecast_snapshot)).to be_persisted
      end

      it "redirects to the created forecast_snapshot" do
        post :create, params: {forecast_snapshot: valid_attributes}, session: valid_session
        expect(response).to redirect_to(ForecastSnapshot.last)
      end
    end

    context "with invalid params" do
      it "assigns a newly created but unsaved forecast_snapshot as @forecast_snapshot" do
        post :create, params: {forecast_snapshot: invalid_attributes}, session: valid_session
        expect(assigns(:forecast_snapshot)).to be_a_new(ForecastSnapshot)
      end

      it "re-renders the 'new' template" do
        post :create, params: {forecast_snapshot: invalid_attributes}, session: valid_session
        expect(response).to render_template("new")
      end
    end
  end

  describe "PUT #update" do
    context "with valid params" do
      let(:new_attributes) {
        skip("Add a hash of attributes valid for your model")
      }

      it "updates the requested forecast_snapshot" do
        forecast_snapshot = ForecastSnapshot.create! valid_attributes
        put :update, params: {id: forecast_snapshot.to_param, forecast_snapshot: new_attributes}, session: valid_session
        forecast_snapshot.reload
        skip("Add assertions for updated state")
      end

      it "assigns the requested forecast_snapshot as @forecast_snapshot" do
        forecast_snapshot = ForecastSnapshot.create! valid_attributes
        put :update, params: {id: forecast_snapshot.to_param, forecast_snapshot: valid_attributes}, session: valid_session
        expect(assigns(:forecast_snapshot)).to eq(forecast_snapshot)
      end

      it "redirects to the forecast_snapshot" do
        forecast_snapshot = ForecastSnapshot.create! valid_attributes
        put :update, params: {id: forecast_snapshot.to_param, forecast_snapshot: valid_attributes}, session: valid_session
        expect(response).to redirect_to(forecast_snapshot)
      end
    end

    context "with invalid params" do
      it "assigns the forecast_snapshot as @forecast_snapshot" do
        forecast_snapshot = ForecastSnapshot.create! valid_attributes
        put :update, params: {id: forecast_snapshot.to_param, forecast_snapshot: invalid_attributes}, session: valid_session
        expect(assigns(:forecast_snapshot)).to eq(forecast_snapshot)
      end

      it "re-renders the 'edit' template" do
        forecast_snapshot = ForecastSnapshot.create! valid_attributes
        put :update, params: {id: forecast_snapshot.to_param, forecast_snapshot: invalid_attributes}, session: valid_session
        expect(response).to render_template("edit")
      end
    end
  end

  describe "DELETE #destroy" do
    it "destroys the requested forecast_snapshot" do
      forecast_snapshot = ForecastSnapshot.create! valid_attributes
      expect {
        delete :destroy, params: {id: forecast_snapshot.to_param}, session: valid_session
      }.to change(ForecastSnapshot, :count).by(-1)
    end

    it "redirects to the forecast_snapshots list" do
      forecast_snapshot = ForecastSnapshot.create! valid_attributes
      delete :destroy, params: {id: forecast_snapshot.to_param}, session: valid_session
      expect(response).to redirect_to(forecast_snapshots_url)
    end
  end

end
