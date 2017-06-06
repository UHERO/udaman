class SourceDetailsController < ApplicationController
  before_action :set_source_detail, only: [:show, :edit, :update, :destroy]

  # GET /source_details
  def index
    @source_details = SourceDetail.order(:description).all
  end

  # GET /source_details/1
  def show
  end

  # GET /source_details/new
  def new
    @source_detail = SourceDetail.new
  end

  # GET /source_details/1/edit
  def edit
  end

  # POST /source_details
  def create
    @source_detail = SourceDetail.new(source_detail_params)

    if @source_detail.save
      redirect_to @source_detail, notice: 'Source detail was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /source_details/1
  def update
    if @source_detail.update(source_detail_params)
      redirect_to @source_detail, notice: 'Source detail was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /source_details/1
  def destroy
    @source_detail.destroy
    redirect_to source_details_url, notice: 'Source detail was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_source_detail
      @source_detail = SourceDetail.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def source_detail_params
      params.require(:source_detail).permit(:description)
    end
end
