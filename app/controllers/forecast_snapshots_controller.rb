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
    respond_to do |format|
      format.csv { render layout: false }
      format.html # show.html.erb
    end
  end

  def table
    @all_dates = @tsd_files[0].get_all_dates
    future = @all_dates.index {|date| date > Date.today.to_s }
    def_start = future ? future - 2 : 0
    last_item = @all_dates.count - 1
    user_start = params[:table_start].blank? ? nil : params[:table_start].to_i
    user_end = params[:table_end].blank? ? nil : params[:table_end].to_i
    @t_start = [user_start, def_start, 0].select {|x| @all_dates[x] rescue false }[0]
    @t_end = [user_end, def_start + 6, last_item].select {|x| @all_dates[x] rescue false }[0]
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
    if forecast_snapshot_params[:new_forecast_tsd_filename]
      @forecast_snapshot.delete_file_from_disk(@forecast_snapshot.new_forecast_tsd_filename)
    end
    if forecast_snapshot_params[:old_forecast_tsd_filename]
      @forecast_snapshot.delete_file_from_disk(@forecast_snapshot.old_forecast_tsd_filename)
    end
    if forecast_snapshot_params[:history_tsd_filename]
      @forecast_snapshot.delete_file_from_disk(@forecast_snapshot.history_tsd_filename)
    end

    unless @forecast_snapshot.update!(forecast_snapshot_params)
      render :edit
      return
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
