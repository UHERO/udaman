class ForecastSnapshotsController < ApplicationController
  include Authorization

  before_action :check_forecast_snapshot_authorization
  before_action :set_forecast_snapshot, only: [:show, :table, :edit, :duplicate, :update, :destroy, :pull_file]
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

  def duplicate
    @forecast_snapshot = @forecast_snapshot.make_copy
    @isa_dup = true if current_user.admin_user?
    render :edit
  end

  def edit
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

  def update
    @forecast_snapshot.delete_new_forecast_tsd_file if forecast_snapshot_params[:new_forecast_tsd_filename]
    @forecast_snapshot.delete_old_forecast_tsd_file if forecast_snapshot_params[:old_forecast_tsd_filename]
    @forecast_snapshot.delete_history_tsd_file if forecast_snapshot_params[:history_tsd_filename]

    unless @forecast_snapshot.update(forecast_snapshot_params)
      render :edit
    end
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
      redirect_to @forecast_snapshot, notice: 'Forecast snapshot was successfully updated.'
    else
      render :edit
    end
  end

  def destroy
    @forecast_snapshot.destroy
    redirect_to forecast_snapshots_url
  end

  def pull_file
    unless ForecastSnapshot.attribute_names.include?(params[:type])
      Rails.logger.warn { 'WARNING! Attempt to access filesystem using parameter %s' % params[:type] }
      return
    end
    filename = @forecast_snapshot.send(params[:type])
    send_file File.join(ENV['DATA_PATH'], @forecast_snapshot.tsd_rel_filepath(filename))
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
end
