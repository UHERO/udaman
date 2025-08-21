class ForecastSnapshotsController < ApplicationController
  include Authorization
  include HelperUtilities

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
    var_setup
    respond_to do |format|
      format.csv { render(layout: false) }
      format.html # show.html.erb
    end
  end

  def table
    var_setup
  end

  def new
    @forecast_snapshot = ForecastSnapshot.new
  end

  def duplicate
    @forecast_snapshot = @forecast_snapshot.make_copy
    @isa_dup = true if current_user.admin_user?
    render(:edit)
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
      redirect_to(@forecast_snapshot, notice: 'Forecast snapshot was successfully stored.')
    else
      render(:new)
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
      render(:edit)
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
      redirect_to(@forecast_snapshot, notice: 'Forecast snapshot was successfully updated.')
    else
      render(:edit)
    end
  end

  def destroy
    @forecast_snapshot.destroy
    redirect_to(forecast_snapshots_path)
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
      id = params[:id] || params[:forecast_snapshot_id]
      @forecast_snapshot = ForecastSnapshot.find(id)
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

    def var_setup
      max_horizon = Date.new(Date.today.year + 30, 12).to_s
      @all_dates = []
      @tsd_files.each do |tsd_file|
        begin
          @all_dates |= tsd_file.get_all_dates(nils: true)
        rescue Errno::ENOENT => e
          Rails.logger.error "TSD file not found: #{tsd_file.path} - #{e.message}"
          # Continue processing with other files
        end
      end
      @all_dates = @all_dates.reject {|d| d > max_horizon }.sort

      # Handle case where no valid TSD files were found
      if @all_dates.empty?
        Rails.logger.warn "No valid dates found for forecast snapshot #{@forecast_snapshot.id}"
        @all_dates = [Date.today.to_s]  # Provide a fallback date
      end

      @date_disp_f = lambda {|d| d[0..3] }  ### Annual
      years_past = 10
      years_fut = 5
      ending_month = 1
      if @all_dates.any? {|s| s =~ /-(04|07|10)-/ }  ### Quarterly
        @date_disp_f = lambda {|d| date_to_qspec(d) }
        ending_month = 10
      end
      if @all_dates.any? {|s| s =~ /-(02|05|08)-/ } ### Monthly
        @date_disp_f = lambda {|d| d[0..6] }
        years_past = 3
        years_fut = 1
        ending_month = 12
      end

      default_from = Date.new(Date.today.year - years_past).to_s
      default_to   = Date.new(Date.today.year + years_fut, ending_month).to_s
      user_from = params[:sample_from]
      user_to   = params[:sample_to]
      @sampl_fr = [user_from, default_from].select {|x| @all_dates.include? x }[0] || @all_dates[0]
      @sampl_to = [user_to, default_to].select {|x| @all_dates.include? x }[0] || @all_dates[-1]
    end

    def set_tsd_files
      @tsd_files = [ @forecast_snapshot.new_forecast_tsd,
                     @forecast_snapshot.old_forecast_tsd,
                     @forecast_snapshot.history_tsd ]
    end

    # Helper method for views to safely access TSD file data
    helper_method :safe_tsd_series
    def safe_tsd_series(tsd_file, nils: false)
      return [] unless tsd_file
      begin
        tsd_file.get_all_series(nils: nils)
      rescue Errno::ENOENT => e
        Rails.logger.error "TSD file not found when accessing series: #{tsd_file.path} - #{e.message}"
        []
      end
    end
end
