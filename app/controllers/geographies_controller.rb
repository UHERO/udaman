class GeographiesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_geography, only: [:show, :edit, :update, :destroy]

  # GET /geographies
  def index
    @universe = params[:u].upcase rescue 'UHERO'
    @geographies = Geography.where(universe: @universe).order('COALESCE(list_order, 999), handle')
  end

  # GET /geographies/1
  def show
  end

  # GET /geographies/new
  def new
    @geography = Geography.new
    @universe = params[:u].upcase rescue params[:universe].upcase rescue 'UHERO'
  end

  # GET /geographies/1/edit
  def edit
  end

  # POST /geographies
  def create
    properties = geography_params
    unless params[:universe].blank?
      properties.merge!(universe: params[:universe])
    end
    @geography = Geography.new(properties)

    if @geography.save
      @geography.reload
      redirect_to geographies_path(u: @geography.universe), notice: 'Geography was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /geographies/1
  def update
    if @geography.update(geography_params)
      redirect_to geographies_path(u: @geography.universe), notice: 'Geography was successfully updated.'
    else
      render :edit
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_geography
      @geography = Geography.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def geography_params
      params.require(:geography).permit(:fips, :display_name, :display_name_short, :handle)
    end
end
