class DashboardsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def investigate_visual
    @err_summary = Loader.load_error_summary
    @all_reload_jobs = ReloadJob.where('user_id > 1').order(created_at: :desc)  ## User id 1 is the system/cron user, don't show those
  end

  def rerun_job
    job = ReloadJob.find(params[:id].to_i) rescue raise("Could not find existing ReloadJob id = #{params[:id]}")
    job.rerun_as(current_user)
    redirect_to :investigate_visual
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
    %x{ssh uhero@uhero13.colo.hawaii.edu "/home/uhero/filesync.sh"}
    render json: { message: "NAS file sync #{$?.success? ? 'done' : 'FAIL'}" }
  end

  def clear_api_cache
    Rails.logger.info { 'Performing clear of API cache' }
    %x{ssh uhero@uhero12.colo.hawaii.edu "bin/clear_api_cache.sh /v1/"}
    render json: { message: "NAS file sync #{$?.success? ? 'done' : 'FAIL'}" }
  end
end
