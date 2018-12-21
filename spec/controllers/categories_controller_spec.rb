require 'rails_helper'

RSpec.describe CategoriesController, type: :controller do

  # This should return the minimal set of attributes required to create a valid
  # Category. As you add validations to Category, be sure to
  # adjust the attributes here as well.
  let(:valid_attributes) {
    {name: 'Category Example'}
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
    it 'assigns all categories as @categories' do
      category = Category.create! valid_attributes
      get :index, params: {}
      expect(assigns(:category_roots)).to eq([category])
    end
  end

  describe 'GET #show' do
    it 'assigns the requested category as @category' do
      category = Category.create! valid_attributes
      get :show, params: {id: category.to_param}
      expect(assigns(:category)).to eq(category)
    end
  end

  describe 'GET #new' do
    it 'assigns a new category as @category' do
      get :new, params: {}
      expect(assigns(:category)).to be_a_new(Category)
    end
  end

  describe 'GET #edit' do
    it 'assigns the requested category as @category' do
      category = Category.create! valid_attributes
      get :edit, params: {id: category.to_param}
      expect(assigns(:category)).to eq(category)
    end
  end

  describe 'POST #create' do
    context 'with valid params' do
      it 'creates a new Category' do
        expect {
          post :create, params: {category: valid_attributes}
        }.to change(Category, :count).by(1)
      end

      it 'assigns a newly created category as @category' do
        post :create, params: {category: valid_attributes}
        expect(assigns(:category)).to be_a(Category)
        expect(assigns(:category)).to be_persisted
      end

      it 'redirects to the created category' do
        post :create, params: {category: valid_attributes}
        expect(response).to redirect_to(Category.last)
      end
    end

    context 'with invalid params' do
      it 'assigns a newly created but unsaved category as @category' do
        post :create, params: {category: invalid_attributes}
        expect(assigns(:category)).to be_a_new(Category)
      end

      it "re-renders the 'new' template" do
        post :create, params: {category: invalid_attributes}
        expect(response).to render_template('new')
      end
    end
  end

  describe 'PUT #update' do
    context 'with valid params' do
      let(:new_attributes) {
        skip('Add a hash of attributes valid for your model')
      }

      it 'updates the requested category' do
        category = Category.create! valid_attributes
        put :update, params: {id: category.to_param, category: new_attributes}
        category.reload
        skip('Add assertions for updated state')
      end

      it 'assigns the requested category as @category' do
        category = Category.create! valid_attributes
        put :update, params: {id: category.to_param, category: valid_attributes}
        expect(assigns(:category)).to eq(category)
      end

      it 'redirects to the categories list' do
        category = Category.create! valid_attributes
        put :update, params: {id: category.to_param, category: valid_attributes}
        expect(response).to redirect_to(categories_url)
      end
    end

    context 'with invalid params' do
      it 'assigns the category as @category' do
        category = Category.create! valid_attributes
        put :update, params: {id: category.to_param, category: invalid_attributes}
        expect(assigns(:category)).to eq(category)
      end

      it "re-renders the 'edit' template" do
        category = Category.create! valid_attributes
        put :update, params: {id: category.to_param, category: invalid_attributes}
        expect(response).to render_template('edit')
      end
    end
  end

  describe 'DELETE #destroy' do
    it 'destroys the requested category' do
      category = Category.create! valid_attributes
      expect {
        delete :destroy, params: {id: category.to_param}
      }.to change(Category, :count).by(-1)
    end

    it 'redirects to the categories list' do
      category = Category.create! valid_attributes
      delete :destroy, params: {id: category.to_param}
      expect(response).to redirect_to(categories_url)
    end
  end
end
