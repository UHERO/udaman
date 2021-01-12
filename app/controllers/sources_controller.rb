class SourcesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_source, only: [:show, :edit, :update, :destroy]

  def index
    @universe = params[:u].upcase rescue 'UHERO'
    @sources = Source.where(universe: @universe).order(:description).all
  end

  def show
  end

  def new
    @source = Source.new
    @universe = params[:u].upcase rescue params[:universe].upcase rescue 'UHERO'
  end

  def edit
  end

  # POST /sources
  def create
    @source = Source.new(source_params)

    if @source.save
      @source.reload
      redirect_to sources_path(u: @source.universe), notice: 'Source was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /sources/1
  def update
    properties = source_params.to_h
    properties.delete(:universe)  ## don't allow update of universe
    if @source.update(properties)
      redirect_to sources_path(u: @source.universe), notice: 'Source was successfully updated.'
    else
      render :edit
    end
  end

private
    # Use callbacks to share common setup or constraints between actions.
    def set_source
      @source = Source.find params[:id]
    end

    # Only allow a trusted parameter "white list" through.
    def source_params
      params.require(:source).permit(:description, :link, :universe)
    end
end
