class TsdFilesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_tsd_file, only: [:show, :edit, :update, :destroy, :unassociate]

  TSD_PATH = 'tsd_files'

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
    uploaded_file = params[:tsd_file][:path]
    filepath = make_new_filepath(uploaded_file.original_filename)
    File.open(Rails.root.join(ENV['DATA_PATH']+filepath), 'wb') do |file|
      file.write(uploaded_file.read)
    end
    params[:tsd_file][:path] = filepath
    @tsd_file = TsdFile.new(tsd_file_params)

    if @tsd_file.save
      redirect_to @tsd_file.forecast_snapshot, notice: 'TSD file was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /tsd_files/1
  def update
    if @tsd_file.update(tsd_file_params)
      redirect_to @tsd_file, notice: 'Tsd file was successfully updated.'
    else
      render :edit
    end
  end

  def unassociate_obsolete_can_delete?
    fsname = @fs ? @fs.name : 'None'
    @tsd_file.forecast_snapshot_id = nil

    if @tsd_file.save
      redirect_to @tsd_file, notice: "TSD file was unassociated from #{fsname}."
    end
  end

  # DELETE /tsd_files/1
  def destroy
    fs = @tsd_file.forecast_snapshot
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
      params.require(:tsd_file).permit(:path, :latest, :forecast_snapshot_id)
    end

    def make_new_filepath(name)
      '/'+TSD_PATH+'/'+name
    end
end
