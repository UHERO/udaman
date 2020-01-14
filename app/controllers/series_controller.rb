class SeriesController < ApplicationController
  include Authorization

  before_action :check_authorization, except: [:index]
  before_action :set_series, only: [:show, :edit, :update, :destroy, :new_alias, :alias_create, :analyze, :add_to_quarantine, :remove_from_quarantine,
                                    :json_with_change, :show_forecast, :refresh_aremos, :comparison_graph, :outlier_graph,
                                    :all_tsd_chart, :blog_graph, :render_data_points, :update_notes]

  def new
    @universe = params[:u].upcase rescue 'UHERO'
    @series = Series.new(universe: @universe, xseries: Xseries.new)
    set_attrib_resource_values(@series)
  end

  def bulk_new
  end

  def edit
    @add2meas = params[:add_to_meas].to_i
    set_attrib_resource_values(@series)
  end

  def create
    begin
      @series = Series.create_new( series_params.merge(name_parts: name_parts) )
    rescue => error
      redirect_to({ action: :new }, notice: error.message)
      return
    end
    if @series
      redirect_to @series, notice: 'Series successfully created'
    else
      render :new
    end
  end

  def new_alias
    @orig_sid = @series.id
    @series = @series.dup
    @series.assign_attributes(universe: params[:new_univ])
    set_attrib_resource_values(@series)
    @add2meas = params[:add_to_meas].to_i
  end

  def alias_create
    @series = @series.create_alias(series_params)
    mid = params[:add2meas].to_i
    if mid > 0
      redirect_to controller: :measurements, action: :add_series, id: mid, series_id: @series.id
    else
      redirect_to @series, notice: 'Alias series successfully created'
    end
  end

  def update
    respond_to do |format|
      if @series.update! series_params
        mid = params[:add2meas].to_i
        if mid > 0
          redirect_to controller: :measurements, action: :add_series, id: mid, series_id: @series.id
          return
        end
        format.html { redirect_to(@series, notice: 'Series successfully updated') }
        format.xml  { head :ok }
      else
        format.html { render action: :edit }
        format.xml  { render xml: @series.errors, status: :unprocessable_entity }
      end
    end
  end

  # POST /series/bulk
  def bulk_create
    if Series.bulk_create( bulk_params[:definitions].split(/\n+/).map(&:strip) )
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
    unless current_user.internal_user?
      render text: 'Your current role only gets to see this page.', layout: true
      return
    end
    @all_series = []
  end

  def new_search
    @all_series = Series.new_search(params[:search_string])
    if @all_series.count == 1
      @series = @all_series.first
      show(true)  ## call controller prep without render
      render :show
      return
    end
    render :index
  end

  def show(no_render = false)
    @as = AremosSeries.get @series.name
    @chg = @series.annualized_percentage_change params[:id]
    @ytd_chg = @series.ytd_percentage_change params[:id]
    @lvl_chg = @series.absolute_change params[:id]
    @desc = @as.nil? ? 'No Aremos Series' : @as.description
    @dsas = @series.data_source_actions
    return if no_render

    respond_to do |format|
      format.csv { render :layout => false }
      format.html # show.html.erb
      format.json { render :json => @series }
    end
  end

  def no_source
    @series = Series.get_all_uhero.where('source_id is null')
                    .order(:name).paginate(page: params[:page], per_page: 50)
  end

  def no_source_no_restrict
    @series = Series.get_all_uhero.where('source_id is null and restricted = false')
                    .order(:name).paginate(page: params[:page], per_page: 50)
  end

  def quarantine
    @series = Series.get_all_uhero.where('quarantined = true and restricted = false')
                    .order(:name).paginate(page: params[:page], per_page: 50)
  end

  def old_bea_download
    @old_bea_series = Series.get_old_bea_downloads
    respond_to do |format|
      format.csv { render layout: false }
      format.html
    end
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
    if @series
      dest[:id] = @series.id if dest[:action] == :show
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

  ## IS THIS ACTION REALLY USED by users? If not, it and the model method get_tsd_series_data() it calls can be 86-ed.
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

  # obsolete/vestigial code?
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

  def render_data_points
    render :partial => 'data_points', :locals => {:series => @series, :as => @as}
  end
  
  def update_notes
    @series.update_attributes(investigation_notes: params[:note])
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
          :universe,
          :description,
          :dataPortalName,
          :unit_id,
          :source_id,
          :source_link,
          :source_detail_id,
          :investigation_notes,
          :decimals,
          xseries_attributes: [
              :percent, :real, :units, :restricted, :seasonal_adjustment, :frequency_transform
          ]
      )
    end

  def name_parts
    params.require(:name_parts).permit(:prefix, :geography_id, :freq)
  end

  def bulk_params
    params.require(:bulk_defs).permit(:definitions)
  end

  def set_series
    @series = Series.find params[:id]
  end

  def set_attrib_resource_values(series)
    primary_univ = series.has_primary? ? series.primary_series.universe : 'UHERO'
    @all_geos = Geography.where(universe: series.universe)
    if @all_geos.empty?
      raise "Universe #{series.universe} has no geographies of its own"
    end
    @all_units = Unit.where(universe: series.universe)
    @all_units = Unit.where(universe: primary_univ) if @all_units.empty?
    @all_sources = Source.where(universe: series.universe)
    @all_sources = Source.where(universe: primary_univ) if @all_sources.empty?
    @all_details = SourceDetail.where(universe: series.universe)
    @all_details = SourceDetail.where(universe: primary_univ) if @all_details.empty?
  end

  # obsolete/vestigial code?
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
