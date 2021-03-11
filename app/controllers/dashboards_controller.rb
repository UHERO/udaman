class DashboardsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def investigate
    @maybe_ok = Series.get_all_uhero.where('aremos_missing = 0 AND ABS(aremos_diff) < 1.0 AND ABS(aremos_diff) > 0.0').order('aremos_diff DESC')
    @wrong = Series.get_all_uhero.where('aremos_missing = 0 AND ABS(aremos_diff) >= 1.0').order('aremos_diff DESC')
    @missing_low_to_high = Series.get_all_uhero.where('aremos_missing > 0').order('aremos_missing ASC')
    
    handle_hash = DataSource.handle_hash
    @maybe_ok_buckets = Series.handle_buckets(@maybe_ok, handle_hash)
    @wrong_buckets = Series.handle_buckets(@wrong, handle_hash)
    @missing_low_to_high_buckets = Series.handle_buckets(@missing_low_to_high, handle_hash)
    
    @bucket_keys = (@maybe_ok_buckets.keys + @wrong_buckets.keys + @missing_low_to_high_buckets.keys).uniq
  end
  
  def investigate_visual
    @diff_data = []
    @to_investigate = Series.get_all_uhero.where('aremos_missing > 0 OR ABS(aremos_diff) > 0.0').order('name ASC')
    @err_summary = DataSource.load_error_summary
    @all_reload_jobs = ReloadJob.where('user_id > 1').order(created_at: :desc)  ## User id 1 is the system/cron user, don't show those
  end

  def destroy_reload_job
    job_id = params[:id].to_i
    return if job_id < 1
    ReloadJob.find(job_id).destroy rescue nil
    redirect_to :investigate_visual
  end

  def update_public_dp
    Rails.logger.info { 'Updating public data points for all universes' }
    DataPoint.update_public_all_universes
    Rails.logger.info { 'DONE updating public data points for all universes' }
    respond_to do |format|
      format.js { head :ok }
    end
  end

  def export_tsd
    Rails.logger.info { 'Performing TSD export' }
    ExportWorker.perform_async
    render json: { message: 'Export queued for worker' }
  end

  def restart_restapi
    Rails.logger.info { 'Performing REST API restart' }
    %x{sudo systemctl restart rest-api.service}
    render json: { message: "REST API restart #{$?.success? ? 'done' : 'FAIL'}" }
  end

  def restart_dvwapi
    Rails.logger.info { 'Performing DVW API restart' }
    %x{sudo systemctl restart dvw-api.service}
    render json: { message: "DVW API restart #{$?.success? ? 'done' : 'FAIL'}" }
  end

  def force_sync_files
    Rails.logger.info { 'Performing NAS file sync' }
    %x{ssh uhero@file.uhero.hawaii.edu "/home/uhero/filesync.sh"}
    render json: { message: "NAS file sync #{$?.success? ? 'done' : 'FAIL'}" }
  end
end
