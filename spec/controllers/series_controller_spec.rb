require 'spec_helper'

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

describe SeriesController do

  # This should return the minimal set of attributes required to create a valid
  # Series. As you add validations to Series, be sure to
  # update the return value of this method accordingly.
  def valid_attributes
    {}
  end

  describe "GET index" do
    xit "assigns all series as @series" do
      series = Series.create! valid_attributes
      get :index, params: {}
      assigns(:series).should eq([series])
    end
  end

  describe "GET show" do
    xit "assigns the requested series as @series" do
      series = Series.create! valid_attributes
      get :show, params: { :id => series.id.to_s }
      assigns(:series).should eq(series)
    end
  end

  describe "GET new" do
    xit "assigns a new series as @series" do
      get :new, params: {}
      assigns(:series).should be_a_new(Series)
    end
  end

  describe "GET edit" do
    xit "assigns the requested series as @series" do
      series = Series.create! valid_attributes
      get :edit, params: { :id => series.id.to_s }
      assigns(:series).should eq(series)
    end
  end

  describe "POST create" do
    describe "with valid params" do
      xit "creates a new Series" do
        expect {
          post :create, params: { :series => valid_attributes }
        }.to change(Series, :count).by(1)
      end

      xit "assigns a newly created series as @series" do
        post :create, params: { :series => valid_attributes }
        assigns(:series).should be_a(Series)
        assigns(:series).should be_persisted
      end

      xit "redirects to the created series" do
        post :create, params: { :series => valid_attributes }
        response.should redirect_to(Series.last)
      end
    end

    describe "with invalid params" do
      xit "assigns a newly created but unsaved series as @series" do
        # Trigger the behavior that occurs when invalid params are submitted
        Series.any_instance.stub(:save).and_return(false)
        post :create, params: { :series => {} }
        assigns(:series).should be_a_new(Series)
      end

      xit "re-renders the 'new' template" do
        # Trigger the behavior that occurs when invalid params are submitted
        Series.any_instance.stub(:save).and_return(false)
        post :create, params: { :series => {} }
        response.should render_template("new")
      end
    end
  end

  describe "PUT update" do
    describe "with valid params" do
      xit "updates the requested series" do
        series = Series.create! valid_attributes
        # Assuming there are no other series in the database, this
        # specifies that the Series created on the previous line
        # receives the :update_attributes message with whatever params are
        # submitted in the request.
        Series.any_instance.should_receive(:update_attributes).with({'these' => 'params'})
        put :update, params: { :id => series.id, :series => {'these' => 'params'} }
      end

      xit "assigns the requested series as @series" do
        series = Series.create! valid_attributes
        put :update, params: { :id => series.id, :series => valid_attributes }
        assigns(:series).should eq(series)
      end

      xit "redirects to the series" do
        series = Series.create! valid_attributes
        put :update, params: { :id => series.id, :series => valid_attributes }
        response.should redirect_to(series)
      end
    end

    describe "with invalid params" do
      xit "assigns the series as @series" do
        series = Series.create! valid_attributes
        # Trigger the behavior that occurs when invalid params are submitted
        Series.any_instance.stub(:save).and_return(false)
        put :update, params: { :id => series.id.to_s, :series => {} }
        assigns(:series).should eq(series)
      end

      xit "re-renders the 'edit' template" do
        series = Series.create! valid_attributes
        # Trigger the behavior that occurs when invalid params are submitted
        Series.any_instance.stub(:save).and_return(false)
        put :update, params: { :id => series.id.to_s, :series => {} }
        response.should render_template("edit")
      end
    end
  end

  describe "DELETE destroy" do
    xit "destroys the requested series" do
      series = Series.create! valid_attributes
      expect {
        delete :destroy, params: { :id => series.id.to_s }
      }.to change(Series, :count).by(-1)
    end

    xit "redirects to the series list" do
      series = Series.create! valid_attributes
      delete :destroy, params: { :id => series.id.to_s }
      response.should redirect_to(series_index_url)
    end
  end

end
