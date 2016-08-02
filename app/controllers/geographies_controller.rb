class GeographiesController < ApplicationController
  before_action :set_geography, only: [:show, :edit, :update, :destroy]

  # GET /geographies
  def index
    @geographies = Geography.all
  end

  # GET /geographies/1
  def show
  end

  # GET /geographies/new
  def new
    @geography = Geography.new
  end

  # GET /geographies/1/edit
  def edit
  end

  # POST /geographies
  def create
    @geography = Geography.new(geography_params)

    if @geography.save
      redirect_to @geography, notice: 'Geography was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /geographies/1
  def update
    if @geography.update(geography_params)
      redirect_to @geography, notice: 'Geography was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /geographies/1
  def destroy
    @geography.destroy
    redirect_to geographies_url, notice: 'Geography was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_geography
      @geography = Geography.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def geography_params
      params.require(:geography).permit(:fips, :name, :handle)
    end
end
