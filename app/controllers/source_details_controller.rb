class SourceDetailsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_source_detail, only: [:show, :edit, :update, :destroy]

  def index
    @universe = params[:u].upcase rescue 'UHERO'
    @source_details = SourceDetail.where(universe: @universe).order(:description).all
  end

  def show
  end

  def new
    @source_detail = SourceDetail.new
    @universe = params[:u].upcase rescue params[:universe].upcase rescue 'UHERO'
  end

  def edit
  end

  # POST /source_details
  def create
    @source_detail = SourceDetail.new(source_detail_params)

    if @source_detail.save
      redirect_to source_details_path(u: @source.universe), notice: 'Source detail was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /source_details/1
  def update
    properties = source_detail_params.to_h
    properties.delete(:universe)  ## don't allow update of universe
    if @source_detail.update(properties)
      redirect_to source_details_path(u: @source.universe), notice: 'Source detail was successfully updated.'
    else
      render :edit
    end
  end

private
    # Use callbacks to share common setup or constraints between actions.
    def set_source_detail
      @source_detail = SourceDetail.find params[:id]
    end

    # Only allow a trusted parameter "white list" through.
    def source_detail_params
      params.require(:source_detail).permit(:description, :universe)
    end
end
