class TsdFilesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_tsd_file, only: [:show, :edit, :update, :destroy, :unassociate]

  # GET /tsd_files
  def index
    @tsd_files = TsdFile.all
  end

  # GET /tsd_files/1
  def show
  end

  # GET /tsd_files/new
  def new
    @fs = ForecastSnapshot.find_by id: params[:forecast_snapshot_id]
    @tsd_file = TsdFile.new(:forecast_snapshot_id => @fs.id)
  end

  # POST /tsd_files
  def create
    uploaded_file = params[:tsd_file][filename]
    filecontent = uploaded_file.read
## validate filecontent
    params[:tsd_file][:filename] = uploaded_file.original_filename
    @tsd_file = TsdFile.new(tsd_file_params)

    if @tsd_file.save
      if @tsd_file.write_to_disk(filecontent)
        redirect_to @tsd_file.forecast_snapshot, notice: 'TSD file was successfully created.'
      else
        # do something
      end
    else
      render :new
    end
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
    fs = @tsd_file.forecast_snapshot
    path = File.join(ENV['DATA_PATH'], tsd_rel_filepath(@tsd_file.filename))
    begin
      File.delete(path)
    rescue StandardError => e
      Rails.logger.error e.message
      redirect_to forecast_snapshot_path(fs), notice: "Failed to remove TSD file #{path}: #{e.message}"
      return
    end
    @tsd_file.destroy
    redirect_to forecast_snapshot_path(fs), notice: 'TSD file was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_tsd_file
      @tsd_file = TsdFile.find(params[:id])
      @fs = @tsd_file.forecast_snapshot
    end

    # Only allow a trusted parameter "white list" through.
    def tsd_file_params
      params.require(:tsd_file).permit(:filename, :latest, :forecast_snapshot_id)
    end
end
