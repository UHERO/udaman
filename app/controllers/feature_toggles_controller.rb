class FeatureTogglesController < ApplicationController
  before_action :set_feature_toggle, only: [:show, :edit, :update, :destroy]

  # GET /feature_toggles
  def index
    @feature_toggles = FeatureToggle.where(universe: 'UHERO').all
  end

  # GET /feature_toggles/1
  def show
  end

  # GET /feature_toggles/new
  def new
    @feature_toggle = FeatureToggle.new
  end

  # GET /feature_toggles/1/edit
  def edit
  end

  # POST /feature_toggles
  def create
    @feature_toggle = FeatureToggle.new(feature_toggle_params)

    if @feature_toggle.save
      redirect_to @feature_toggle, notice: 'Feature toggle was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /feature_toggles/1
  def update
    if @feature_toggle.update(feature_toggle_params)
      redirect_to @feature_toggle, notice: 'Feature toggle was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /feature_toggles/1
  def destroy
    @feature_toggle.destroy
    redirect_to feature_toggles_url, notice: 'Feature toggle was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_feature_toggle
      @feature_toggle = FeatureToggle.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def feature_toggle_params
      params.require(:feature_toggle).permit(:name, :description, :status)
    end
end
