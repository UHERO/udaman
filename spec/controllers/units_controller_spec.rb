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

RSpec.describe UnitsController, type: :controller do

  # This should return the minimal set of attributes required to create a valid
  # Unit. As you add validations to Unit, be sure to
  # adjust the attributes here as well.
  let(:valid_attributes) {
    skip("Add a hash of attributes valid for your model")
  }

  let(:invalid_attributes) {
    skip("Add a hash of attributes invalid for your model")
  }

  # This should return the minimal set of values that should be in the session
  # in order to pass any filters (e.g. authentication) defined in
  # UnitsController. Be sure to keep this updated too.
  let(:valid_session) { {} }


  before(:each) do
    @request.env['devise.mapping'] = Devise.mappings[:user]
    user = FactoryBot.create(:user)
    sign_in user
  end

  describe "GET #index" do
    it "assigns all units as @units" do
      unit = Unit.create! valid_attributes
      get :index, params: {}, session: valid_session
      expect(assigns(:units)).to eq([unit])
    end
  end

  describe "GET #show" do
    it "assigns the requested unit as @unit" do
      unit = Unit.create! valid_attributes
      get :show, params: {id: unit.to_param}, session: valid_session
      expect(assigns(:unit)).to eq(unit)
    end
  end

  describe "GET #new" do
    xit "assigns a new unit as @unit" do
      get :new, params: {}, session: valid_session
      expect(assigns(:unit)).to be_a_new(Unit)
    end
  end

  describe "GET #edit" do
    it "assigns the requested unit as @unit" do
      unit = Unit.create! valid_attributes
      get :edit, params: {id: unit.to_param}, session: valid_session
      expect(assigns(:unit)).to eq(unit)
    end
  end

  describe "POST #create" do
    context "with valid params" do
      it "creates a new Unit" do
        expect {
          post :create, params: {unit: valid_attributes}, session: valid_session
        }.to change(Unit, :count).by(1)
      end

      it "assigns a newly created unit as @unit" do
        post :create, params: {unit: valid_attributes}, session: valid_session
        expect(assigns(:unit)).to be_a(Unit)
        expect(assigns(:unit)).to be_persisted
      end

      it "redirects to the created unit" do
        post :create, params: {unit: valid_attributes}, session: valid_session
        expect(response).to redirect_to(Unit.last)
      end
    end

    context "with invalid params" do
      it "assigns a newly created but unsaved unit as @unit" do
        post :create, params: {unit: invalid_attributes}, session: valid_session
        expect(assigns(:unit)).to be_a_new(Unit)
      end

      it "re-renders the 'new' template" do
        post :create, params: {unit: invalid_attributes}, session: valid_session
        expect(response).to render_template("new")
      end
    end
  end

  describe "PUT #update" do
    context "with valid params" do
      let(:new_attributes) {
        skip("Add a hash of attributes valid for your model")
      }

      it "updates the requested unit" do
        unit = Unit.create! valid_attributes
        put :update, params: {id: unit.to_param, unit: new_attributes}, session: valid_session
        unit.reload
        skip("Add assertions for updated state")
      end

      it "assigns the requested unit as @unit" do
        unit = Unit.create! valid_attributes
        put :update, params: {id: unit.to_param, unit: valid_attributes}, session: valid_session
        expect(assigns(:unit)).to eq(unit)
      end

      it "redirects to the unit" do
        unit = Unit.create! valid_attributes
        put :update, params: {id: unit.to_param, unit: valid_attributes}, session: valid_session
        expect(response).to redirect_to(unit)
      end
    end

    context "with invalid params" do
      it "assigns the unit as @unit" do
        unit = Unit.create! valid_attributes
        put :update, params: {id: unit.to_param, unit: invalid_attributes}, session: valid_session
        expect(assigns(:unit)).to eq(unit)
      end

      it "re-renders the 'edit' template" do
        unit = Unit.create! valid_attributes
        put :update, params: {id: unit.to_param, unit: invalid_attributes}, session: valid_session
        expect(response).to render_template("edit")
      end
    end
  end

  describe "DELETE #destroy" do
    it "destroys the requested unit" do
      unit = Unit.create! valid_attributes
      expect {
        delete :destroy, params: {id: unit.to_param}, session: valid_session
      }.to change(Unit, :count).by(-1)
    end

    it "redirects to the units list" do
      unit = Unit.create! valid_attributes
      delete :destroy, params: {id: unit.to_param}, session: valid_session
      expect(response).to redirect_to(units_url)
    end
  end

end
