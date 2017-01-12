class ForecastSnapshotsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_forecast_snapshot, only: [:show, :edit, :update, :destroy]

  # GET /forecast_snapshots
  def index
    @forecast_snapshots = ForecastSnapshot.all
  end

  # GET /forecast_snapshots/1
  def show
    @tsd_files = [ @forecast_snapshot.new_forecast_tsd,
                   @forecast_snapshot.old_forecast_tsd,
                   @forecast_snapshot.history_tsd ]
  end

  # GET /forecast_snapshots/new
  def new
    @forecast_snapshot = ForecastSnapshot.new
  end

  # GET /forecast_snapshots/1/edit
  def edit
  end

  # POST /forecast_snapshots
  def create
    @forecast_snapshot = ForecastSnapshot.new(forecast_snapshot_params)

    if forecast_snapshot_params[:new_forecast_tsd_filename]
      newfile = forecast_snapshot_params[:new_forecast_tsd_filename]
      @forecast_snapshot.new_forecast_tsd_filename = newfile.original_filename
    end
    if forecast_snapshot_params[:old_forecast_tsd_filename]
      oldfile = forecast_snapshot_params[:old_forecast_tsd_filename]
      @forecast_snapshot.old_forecast_tsd_filename = oldfile.original_filename
    end
    if forecast_snapshot_params[:history_tsd_filename]
      histfile = forecast_snapshot_params[:history_tsd_filename]
      @forecast_snapshot.history_tsd_filename = histfile.original_filename
    end

    if @forecast_snapshot.store_fs(newfile, oldfile, histfile)
      redirect_to @forecast_snapshot, notice: 'Forecast snapshot was successfully stored.'
    else
      render :new
    end
  end

  # PATCH/PUT /forecast_snapshots/1
  def update
    unless @forecast_snapshot.update(forecast_snapshot_params)
      render :edit
    end

    if forecast_snapshot_params[:new_forecast_tsd_filename]
      newfile = forecast_snapshot_params[:new_forecast_tsd_filename]
      @forecast_snapshot.new_forecast_tsd_filename = newfile.original_filename
    end
    if forecast_snapshot_params[:old_forecast_tsd_filename]
      oldfile = forecast_snapshot_params[:old_forecast_tsd_filename]
      @forecast_snapshot.old_forecast_tsd_filename = oldfile.original_filename
    end
    if forecast_snapshot_params[:history_tsd_filename]
      histfile = forecast_snapshot_params[:history_tsd_filename]
      @forecast_snapshot.history_tsd_filename = histfile.original_filename
    end

    if @forecast_snapshot.store_fs(newfile, oldfile, histfile)
      redirect_to @forecast_snapshot, notice: 'Forecast snapshot was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /forecast_snapshots/1
  def destroy
    @forecast_snapshot.destroy
    redirect_to forecast_snapshots_url, notice: 'Forecast snapshot was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_forecast_snapshot
      @forecast_snapshot = ForecastSnapshot.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def forecast_snapshot_params
      params.require(:forecast_snapshot).permit(:name, :version, :comments, :published,
                                                :new_forecast_tsd_filename,
                                                :new_forecast_tsd_label,
                                                :old_forecast_tsd_filename,
                                                :old_forecast_tsd_label,
                                                :history_tsd_filename,
                                                :history_tsd_label)
    end
end
