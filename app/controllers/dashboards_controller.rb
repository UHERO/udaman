class DashboardsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def index
    @series_count = Series.count
    @aremos_series_count = AremosSeries.count
    @not_in_db = (AremosSeries.all_names - Series.all_names).count
    @in_db = @aremos_series_count - @not_in_db
    @frequency_counts = Series.frequency_counts
    @region_counts = Series.region_counts
    
    @a_counts = Series.last_observation_buckets('year')
    @s_counts = Series.last_observation_buckets('semi')
    @q_counts = Series.last_observation_buckets('quarter')
    @m_counts = @q_counts
    #@m_counts = Series.last_observation_buckets('month')
    
    @data_source_count = DataSource.count
    @type_buckets = DataSource.type_buckets
    #don't want to show the loads, only the transformations
    @sa_count = @type_buckets.delete :sa_load
    @load_count = @type_buckets.delete(:load) + @sa_count + @type_buckets[:mean_corrected_load]
  end

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
  end

  def update_public_dp
    DataPoint.update_public_all_universes
    respond_to do |format|
      format.js { head :ok }
    end
  end

  def export_tsd
    ExportWorker.perform_async
    render :json => { message: 'Export TSD in Queue' }
  end
end
