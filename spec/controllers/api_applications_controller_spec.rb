require 'rails_helper'

RSpec.describe ApiApplicationsController, type: :controller do
  # This should return the minimal set of attributes required to create a valid
  # ApiApplication. As you add validations to ApiApplication, be sure to
  # adjust the attributes here as well.
  let(:valid_attributes) {
    {name: 'Example Name', hostname: 'example.com', api_key: 'A1B2C3', github_nickname: 'bob'}
  }

  let(:invalid_attributes) {
    skip('Add a hash of attributes invalid for your model')
  }

  before(:each) do
    @request.env['devise.mapping'] = Devise.mappings[:user]
    user = FactoryBot.create(:user)
    sign_in user
  end

  describe 'GET #index' do
    it 'assigns all api_applications as @api_applications' do
      api_application = ApiApplication.create! valid_attributes
      get :index, params: {}
      expect(assigns(:api_applications)).to eq([api_application])
    end
  end

  describe 'GET #show' do
    it 'assigns the requested api_application as @api_application' do
      api_application = ApiApplication.create! valid_attributes
      puts api_application.id
      get :show, {id: api_application.to_param}
      puts assigns(:api_application)
      expect(assigns(:api_application)).to eq(api_application)
    end
  end

  describe 'GET #new' do
    it 'assigns a new api_application as @api_application' do
      get :new, params: {}
      expect(assigns(:api_application)).to be_a_new(ApiApplication)
    end
  end

  describe 'GET #edit' do
    it 'assigns the requested api_application as @api_application' do
      api_application = ApiApplication.create! valid_attributes
      get :edit, {id: api_application.to_param}
      expect(assigns(:api_application)).to eq(api_application)
    end
  end

  describe 'POST #create' do
    context 'with valid params' do
      it 'creates a new ApiApplication' do
        expect {
          post :create, {api_application: valid_attributes}
        }.to change(ApiApplication, :count).by(1)
      end

      it 'assigns a newly created api_application as @api_application' do
        post :create, {api_application: valid_attributes}
        expect(assigns(:api_application)).to be_a(ApiApplication)
        expect(assigns(:api_application)).to be_persisted
      end

      it 'redirects to the created api_application' do
        post :create, {api_application: valid_attributes}
        expect(response).to redirect_to(ApiApplication.last)
      end
    end

    context 'with invalid params' do
      it 'assigns a newly created but unsaved api_application as @api_application' do
        post :create, {api_application: invalid_attributes}
        expect(assigns(:api_application)).to be_a_new(ApiApplication)
      end

      it "re-renders the 'new' template" do
        post :create, {api_application: invalid_attributes}
        expect(response).to render_template('new')
      end
    end
  end

  describe 'PUT #update' do
    context 'with valid params' do
      let(:new_attributes) {
        skip('Add a hash of attributes valid for your model')
      }

      it 'updates the requested api_application' do
        api_application = ApiApplication.create! valid_attributes
        put :update, {id: api_application.to_param, api_application: new_attributes}
        api_application.reload
        skip('Add assertions for updated state')
      end

      it 'assigns the requested api_application as @api_application' do
        api_application = ApiApplication.create! valid_attributes
        put :update, {id: api_application.to_param, api_application: valid_attributes}
        expect(assigns(:api_application)).to eq(api_application)
      end

      it 'redirects to the api_application' do
        api_application = ApiApplication.create! valid_attributes
        put :update, {id: api_application.to_param, api_application: valid_attributes}
        expect(response).to redirect_to(api_application)
      end
    end

    context 'with invalid params' do
      it 'assigns the api_application as @api_application' do
        api_application = ApiApplication.create! valid_attributes
        put :update, {id: api_application.to_param, api_application: invalid_attributes}
        expect(assigns(:api_application)).to eq(api_application)
      end

      it "re-renders the 'edit' template" do
        api_application = ApiApplication.create! valid_attributes
        put :update, {id: api_application.to_param, api_application: invalid_attributes}
        expect(response).to render_template('edit')
      end
    end
  end

  describe 'DELETE #destroy' do
    it 'destroys the requested api_application' do
      api_application = ApiApplication.create! valid_attributes
      expect {
        delete :destroy, {id: api_application.to_param}
      }.to change(ApiApplication, :count).by(-1)
    end

    it 'redirects to the api_applications list' do
      api_application = ApiApplication.create! valid_attributes
      delete :destroy, {id: api_application.to_param}
      expect(response).to redirect_to(api_applications_url)
    end
  end

end
