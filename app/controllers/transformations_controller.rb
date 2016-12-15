class TransformationsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_transformation, only: [:show, :edit, :update, :destroy]

  # GET /transformations
  def index
    @transformations = Transformation.all
  end

  # GET /transformations/1
  def show
  end

  # GET /transformations/new
  def new
    @transformation = Transformation.new
  end

  # GET /transformations/1/edit
  def edit
  end

  # POST /transformations
  def create
    @transformation = Transformation.new(transformation_params)

    if @transformation.save
      redirect_to @transformation, notice: 'Transformation was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /transformations/1
  def update
    if @transformation.update(transformation_params)
      redirect_to @transformation, notice: 'Transformation was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /transformations/1
  def destroy
    @transformation.destroy
    redirect_to transformations_url, notice: 'Transformation was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_transformation
      @transformation = Transformation.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def transformation_params
      params.require(:transformation).permit(:key, :description, :formula)
    end
end
