class ForecastSnapshotsController < ApplicationController
  include Authorization

  before_action :check_forecast_snapshot_authorization
  before_action :set_forecast_snapshot, only: [:show, :table, :edit, :duplicate, :update, :destroy]
  before_action :set_tsd_files, only: [:show, :table]

  def index
    if current_user.internal_user?
      fsnaps = ForecastSnapshot.all
    else
      fsnaps = ForecastSnapshot.where(published: true)
    end
    @forecast_snapshots = fsnaps.order('updated_at desc').paginate(page: params[:page], per_page: 50)
  end

  def show
    @forecast_snapshot.old_forecast_tsd
  end

  def table
    @all_dates = @forecast_snapshot.new_forecast_tsd.get_current_plus_five_dates
  end

  def new
    @forecast_snapshot = ForecastSnapshot.new
  end

  def edit
  end

  def duplicate
    @forecast_snapshot = @forecast_snapshot.dup
    @forecast_snapshot.assign_attributes(published: nil, version: increment_version(@forecast_snapshot.version))
    render :new
  end

  def create
    @forecast_snapshot = ForecastSnapshot.new(forecast_snapshot_params)
    newfile = oldfile = histfile = nil

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
    @forecast_snapshot.delete_new_forecast_tsd_file if forecast_snapshot_params[:new_forecast_tsd_filename]
    @forecast_snapshot.delete_old_forecast_tsd_file if forecast_snapshot_params[:old_forecast_tsd_filename]
    @forecast_snapshot.delete_history_tsd_file if forecast_snapshot_params[:history_tsd_filename]

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

    def set_tsd_files
      @tsd_files = [ @forecast_snapshot.new_forecast_tsd,
                     @forecast_snapshot.old_forecast_tsd,
                     @forecast_snapshot.history_tsd ]
    end

    def increment_version(vers)
      if vers =~ /\.(\d+)$/
        vers.sub!(/\.\d+$/, '.%d' % $1.to_i + 1)
      else
        vers += '.2'
      end
      vers
    end
end
