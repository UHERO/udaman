class SeriesController < ApplicationController
  include Authorization

  before_action :check_authorization, except: [:index]
  before_action :set_series, only: [:show, :edit, :update, :destroy, :analyze, :add_to_quarantine, :remove_from_quarantine,
                                    :json_with_change, :show_forecast, :refresh_aremos, :comparison_graph, :outlier_graph,
                                    :all_tsd_chart, :blog_graph, :validate, :toggle_units, :render_data_points,
                                    :toggle_multiplier, :update_notes]

  # GET /series/new
  def new
    @series = Series.new
  end

  # GET /series/bulk
  def bulk_new
  end

  # POST /series
  def create
    begin
      @series = Series.create_new(series_params.merge(other_params))
    rescue => error
      redirect_to({ :action => :new }, :notice => error.message)
      return
    end
    if @series
      redirect_to @series, notice: 'Series was successfully created.'
    else
      render :new
    end
  end

  # POST /series/bulk
  def bulk_create
    if Series.bulk_create other_params[:definitions].split(/\n+/).map{|dfn| dfn.strip }
      redirect_to '/series'
    end
  end

  def index
    if current_user.heco?
      redirect_to :controller => :forecast_snapshots, :action => :index
      return
    end
    if current_user.dbedt?
      redirect_to :controller => :dbedt_uploads, :action => :index
      return
    end
    if current_user.nta?
      redirect_to :controller => :nta_uploads, :action => :index
      return
    end
    unless current_user.internal_user?
      render text: 'Your current role only gets to see this page.', layout: true
      return
    end
    frequency = params.has_key?(:freq) ? params[:freq] : nil
    prefix = params.has_key?(:prefix) ? params[:prefix] : nil
    all = params.has_key?(:all) ? true : false

    @all_series =
      case
        when prefix then    Series.get_all_uhero.where('name LIKE ?', "#{prefix}%").order(:name)
        when frequency then Series.get_all_uhero.where('frequency LIKE ?', frequency).order(:name)
        when all then       Series.get_all_uhero.order(:name)
        else []
      end
  end

  def show
    @as = AremosSeries.get @series.name
    @chg = @series.annualized_percentage_change params[:id]
    @ytd_chg = @series.ytd_percentage_change params[:id]
    @lvl_chg = @series.absolute_change params[:id]
    @desc = @as.nil? ? 'No Aremos Series' : @as.description
    @dsas = @series.data_source_actions
    
    respond_to do |format|
      format.csv { render :layout => false }
      format.html # show.html.erb
      format.json { render :json => @series }
    end
  end

  def no_source
    @series = Series.get_all_uhero.where(source_id: nil)
                    .order(:name).paginate(page: params[:page], per_page: 50)
  end

  def no_source_no_restrict
    @series = Series.get_all_uhero.where(source_id: nil, restricted: false)
                    .order(:name).paginate(page: params[:page], per_page: 50)
  end

  def quarantine
    @series = Series.get_all_uhero.where(quarantined: true, restricted: false)
                    .order(:name).paginate(page: params[:page], per_page: 50)
  end

  def old_bea_download
    @old_bea_series = Series.get_old_bea_downloads
  end

  def sidekiq_failed
    @series = Series.joins(:sidekiq_failures).order(:name)
  end

  def add_to_quarantine
    if @series
      @series.add_to_quarantine
    end
    redirect_to action: :show, id: params[:id]
  end

  def remove_from_quarantine
    dest = { action: params[:next_action] || :show }
    dest[:id] = series_params[:id] if dest[:action] == :show
    if @series
      @series.remove_from_quarantine
    end
    redirect_to dest
  end

  def empty_quarantine
    Series.empty_quarantine
    redirect_to action: :quarantine
  end

  def json_with_change
    render :json => { :series => @series, :chg => @series.annualized_percentage_change}
  end
  
  def show_forecast
    tsd_file = params[:tsd_file]
    if tsd_file.nil?
      render inline: 'WRITE AN ERROR TEMPLATE: You need a tsd_file parameter'
    else
      @series = @series.get_tsd_series_data(tsd_file)
  
      respond_to do |format|
        format.html {render 'analyze'}
        format.json {render :json => { :series => @series, :chg => @series.annualized_percentage_change} }
      end
    end
  end
  
  def edit
  end
  
  def update    
    respond_to do |format|
      if @series.update! series_params
        format.html { redirect_to(@series,
                      :notice => 'Data File successfully updated.') }
        format.xml  { head :ok }
      else
        format.html { render :action => 'edit' }
        format.xml  { render :xml => @series.errors,
                      :status => :unprocessable_entity }
      end
    end
  end

  def refresh_aremos
    @series.aremos_comparison
    redirect_to :action => 'show', id: params[:id]
  end

  def destroy
    @series.destroy
    redirect_to :action => 'index'
  end
  
  def search
    @search_results = AremosSeries.web_search(params[:search])
  end
  
  def autocomplete_search
    render :json => Series.web_search(params[:term], params[:universe])
                          .map {|s| { label: s[:name] + ':' + s[:description], value: s[:series_id] } }
  end

  def comparison_graph
    @comp = @series.aremos_data_side_by_side
  end

  def outlier_graph
    @comp = @series.ma_data_side_by_side
    #residuals is actually whole range of values.
    residuals = @comp.map { |_, ma_hash| ma_hash[:udaman] }
    residuals.reject!{|a| a.nil?}
    average = residuals.inject{ |sum, el| sum + el }.to_f / residuals.count
    @std_dev = Math.sqrt((residuals.inject(0){ | sum, x | sum + (x - average) ** 2 }) / (residuals.count - 1))
  end
  
  def all_tsd_chart
    @all_tsd_files = JSON.parse(open('http://readtsd.herokuapp.com/listnames/json').read)['file_list']
    @all_series_to_chart = []
    @all_tsd_files.each do |tsd|
      data = json_from_heroku_tsd(@series.name, tsd)
      puts tsd
      puts @series.name
      puts data
      @all_series_to_chart.push(Series.new_transformation(
        data['name'] + '.' + data['frequency'] + ':' + tsd,
        data['data'], 
        Series.frequency_from_code(data['frequency'])
        )) unless data.nil? or data['frequency'] != @series.name[-1]
    end
  end
  
  def transform
    eval_statement = convert_to_udaman_notation(params[:eval])
    puts eval_statement
    puts params[:eval]
    @series = eval(eval_statement)

    @chg = @series.annualized_percentage_change
    @desc = ""
    @lvl_chg = @series.absolute_change
    @ytd = @series.ytd_percentage_change
  end
  
  def analyze
  end
  
  def blog_graph
    @start_date = params[:start_date]
    @end_date = params[:end_date]
    chart_to_make = params[:create_post]
    unless chart_to_make.nil?
      @link = chart_to_make == 'line' ? @series.create_blog_post(nil, @start_date, @end_date) : @series.create_blog_post(chart_to_make, @start_date, @end_date)
    end
    @chart_made = chart_to_make
  end
  
  def validate
    @prognoz_data_results = @series.prognoz_data_results
  end
  
  def replace_block
    render :partial => 'replace_block'
  end
  
  def toggle_units
    @series.units = params[:units]
    #@series.save
    @series.aremos_comparison(true)
    @as = AremosSeries.get @series.name
    render :partial => 'toggle_units'
  end
  
  def render_data_points
    render :partial => 'data_points', :locals => {:series => @series, :as => @as}
  end
  
  def toggle_multiplier
    @series.toggle_mult
    #@series.save
    @output_file = PrognozDataFile.find_by id: @series.prognoz_data_file_id
    @output_file.update_series_validated_for @series
    render :partial => 'validate_row'
  end

  def update_notes
    @series.update_attributes({:investigation_notes => params[:note]})
    render :partial => 'investigation_sort'
  end

  def stale
    @stale_series = {}
    stales = Series.stale_since Time.now.days_ago(2)
    stales.each do |s_id, s_name, ds_id|
      @stale_series[s_id] ||= { name: s_name, dsids: [] }
      @stale_series[s_id][:dsids].push ds_id
    end
    @stale_series
  end

  def nightly_missed
    @missed_series = {}
    missed = Series.stale_since Time.now.yesterday
    missed.each do |s_id, s_name, ds_id|
      @missed_series[s_id] ||= { name: s_name, dsids: [] }
      @missed_series[s_id][:dsids].push ds_id
    end
    @missed_series
  end

  def nightly_loaded
    @loaded_series = {}
    loaded = Series.loaded_since Time.now.yesterday
    loaded.each do |s_id, s_name, ds_id|
      @loaded_series[s_id] ||= { name: s_name, dsids: [] }
      @loaded_series[s_id][:dsids].push ds_id
    end
    @loaded_series
  end

  private
    def series_params
      params.require(:series).permit(
          :id,
          :universe,
          :description,
          :units,
          :investigation_notes,
          :dataPortalName,
          :unit_id,
          :seasonal_adjustment,
          :percent,
          :real,
          :decimals,
          :frequency_transform,
          :restricted,
          :source_id,
          :source_link,
          :source_detail_id
      )
    end

  def other_params
    params.permit(:definitions, name_parts: [:prefix, :geo_id, :freq])
  end

  def set_series
    @series = Series.find series_params[:id]
  end

  def convert_to_udaman_notation(eval_string)
    operator_fix = eval_string.gsub('(','( ').gsub(')', ' )').gsub('*',' * ').gsub('/',' / ').gsub('-',' - ').gsub('+',' + ')
    (operator_fix.split(' ').map {|e| (e.index('@').nil? or !e.index('.ts').nil? ) ? e : "\"#{e}\".ts" }).join(' ')
  end

  def json_from_heroku_tsd(series_name, tsd_file)
    url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{series_name[0..-3]}/json")
    res = Net::HTTP.new(url.host, url.port).request_get(url.path)
    res.code == '500' ? nil : JSON.parse(res.body)
  end
end
