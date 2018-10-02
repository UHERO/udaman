class TsdFilesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_tsd_file, only: [:show, :edit, :update, :destroy]

  # GET /tsd_files
  def index
    @tsd_files = TsdFile.all
  end

  # GET /tsd_files/1
  def show
    @filecontent = @tsd_file.retrieve_content
  end

  # GET /tsd_files/new
  def new
    @fs = ForecastSnapshot.find_by id: tsd_file_params[:forecast_snapshot_id]
    @tsd_file = TsdFile.new(:forecast_snapshot_id => @fs.id)
  end

  # POST /tsd_files
  def create
    uploaded_file = tsd_file_params[:filename]
    file_content = uploaded_file.read
## validate filecontent.. here, or in model?
    params[:tsd_file][:filename] = uploaded_file.original_filename ## not sure why I'm doing this, but it looks sketchy.
    @tsd_file = TsdFile.new(tsd_file_params)
    if @tsd_file.store_tsd(file_content)
      notice = 'TSD file was successfully created.'
    else
      notice = 'TSD file was not successfully created.'
    end
    redirect_to edit_forecast_snapshot_path(@tsd_file.forecast_snapshot), notice: notice
  end

  # PATCH/PUT /tsd_files/1
  def update
    if @tsd_file.update(tsd_file_params)
      redirect_to @tsd_file, notice: 'TSD file was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /tsd_files/1
  def destroy
    @tsd_file.destroy
    redirect_to edit_forecast_snapshot_path(@fs), notice: 'TSD file was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_tsd_file
      @tsd_file = TsdFile.find params[:id]
      @fs = @tsd_file.forecast_snapshot
    end

    # Only allow a trusted parameter "white list" through.
    def tsd_file_params
      params.require(:tsd_file).permit(:filename, :latest_forecast, :forecast_snapshot_id)
    end
end
