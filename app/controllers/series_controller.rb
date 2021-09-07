class SeriesController < ApplicationController
  include Authorization
  include Validators

  before_action :check_authorization, except: [:index]
  before_action :set_series,
        only: [:show, :edit, :update, :destroy, :new_alias, :alias_create, :analyze, :add_to_quarantine, :remove_from_quarantine,
               :reload_all, :rename, :save_rename, :json_with_change, :show_forecast, :refresh_aremos, :all_tsd_chart,
               :render_data_points, :update_notes]

  def new
    @universe = params[:u].upcase rescue 'UHERO'
    @series = Series.new(universe: @universe, xseries: Xseries.new)
    set_attrib_resource_values(@series)
  end

  def edit
    @add2meas = params[:add_to_meas].to_i
    set_attrib_resource_values(@series)
  end

  def rename
    @has_aliases = !@series.aliases.empty?
  end

  def save_rename
    new_name = params[:new_name].strip
    if @series.rename(new_name)
      if params[:rename_aliases] == 'yes'
        @series.aliases.each {|a| a.rename(new_name) }
      end
    end
    redirect_to action: :show
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

  def bulk_new
  end

  def bulk_create
    if Series.bulk_create( bulk_params[:definitions].split(/\n+/).map(&:strip) )
      redirect_to action: :index
    end
  end

  def clipboard
    @all_series = current_user.series.reload.sort_by(&:name)
    @clip_empty = @all_series.nil? || @all_series.empty?
    render :clipboard
  end

  def clear_clip
    if params[:id]
      current_user.clear_series(Series.find params[:id].to_i)
      redirect_to action: :clipboard
      return
    end
    current_user.clear_series
    redirect_to action: :index
  end

  def add_clip
    if params[:id]
      current_user.add_series Series.find(params[:id].to_i)
    elsif params[:search]
      results = Series.search_box(params[:search], limit: 500, user_id: current_user.id)
      current_user.clear_series if params[:replace] == 'true'  ## must be done after results collected, in case &noclip is used
      current_user.add_series results
    end
    redirect_to action: :clipboard
  end

  def do_clip_action
    if params[:clip_action] =~ /csv/
      redirect_to action: :group_export, type: params[:clip_action], format: :csv, layout: false
      return
    end
    @status_message = current_user.do_clip_action(params[:clip_action])
    clipboard
  end

  def group_export
    @type = params[:type]
    @all_series = current_user.series.sort_by(&:name)
  end

  def index
    if current_user.fsonly?
      redirect_to controller: :forecast_snapshots, action: :index
      return
    end
    if current_user.dbedt?
      return
    end
    unless current_user.internal_user?
      render text: 'Your current role only gets to see this page.', layout: true
      return
    end
    @all_series = Series.get_all_uhero.order(created_at: :desc).limit(40)
  end

  def new_search(search_string = nil)
    @search_string = search_string || params[:search_string]
    Rails.logger.info { "SEARCHLOG: user=#{current_user.email}, search=#{@search_string}" }
    @all_series = Series.search_box(@search_string, limit: ENV['SEARCH_DEFAULT_LIMIT'].to_i, user_id: current_user.id)
    if @all_series.count == 1
      @series = @all_series.first
      show(no_render: true)  ## call controller prep without render
      render :show
      return
    end
    render :index
  end

  def show(no_render: false)
    @desc = AremosSeries.get(@series.name).description rescue 'No Aremos Series'
    @chg = @series.annualized_percentage_change params[:id]
    @ytd_chg = @series.ytd_percentage_change params[:id]
    @lvl_chg = @series.absolute_change params[:id]
    @dsas = @series.enabled_data_sources.map {|ds| ds.data_source_actions }.flatten
    @clipboarded = current_user.clipboard_contains?(@series)
    @dependencies = @series.who_depends_on_me(['series.name', 'series.id']).sort_by {|a| a[0] }
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

  def forecast_upload
    @fcid = 'none'
    @version = 'none'
  end

  def forecast_do_upload
    params = {}
    @path = params[:filepath] = forecast_upload_params[:filepath].nil_blank
    @fcid = params[:fcid] = forecast_upload_params[:fcid].nil_blank
    @version = params[:version] = forecast_upload_params[:version].nil_blank
    if @path =~ /(\d\dQ\d+)([FH](\d+|F))/i
      @fcid = params[:fcid] ||= $1.upcase        ## explicitly entered fcid/version overrides
      @version = params[:version] ||= $2.upcase  ## those scraped from the filename
    end
    @freq = params[:freq] = forecast_upload_params[:freq].nil_blank
    unless @path && @fcid && @version && @freq
      render :forecast_upload
      return
    end
    created_series_ids = Series.do_forecast_upload(params)
    new_search(created_series_ids.join(','))
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

  def reload_all
    @series.reload_sources
    redirect_to action: :show
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
    @series.destroy!
    redirect_to action: :index
  end
  
  def search
    @search_results = AremosSeries.web_search(params[:search])
  end
  
  def autocomplete_search
    render :json => Series.web_search(params[:term], params[:universe])
                          .map {|s| { label: s[:name] + ':' + s[:description], value: s[:series_id] } }
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
    eval_string = params[:eval].gsub(/([+*\/()-])/, ' \1 ').strip  ## puts spaces around operators and parens
    eval_statement = eval_string.split(' ').map {|e| valid_series_name(e) ? "'#{e}'.ts" : e }.join(' ')
    @series = (Kernel::eval eval_statement) rescue nil
    unless @series
     redirect_to action: :index
     return
    end

    @chg = @series.annualized_percentage_change
    @desc = ""
    @lvl_chg = @series.absolute_change
    @ytd = @series.ytd_percentage_change
  end
  
  def analyze
  end
  
  def render_data_points
    render :partial => 'data_points', :locals => {:series => @series, :as => @as}
  end
  
  def update_notes
    @series.update_attributes(investigation_notes: params[:note])
    render :partial => 'investigation_sort'
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

  def forecast_upload_params
    params.require(:forecast_upload).permit(:fcid, :version, :freq, :filepath)
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

  def json_from_heroku_tsd(series_name, tsd_file)
    url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{series_name[0..-3]}/json")
    res = Net::HTTP.new(url.host, url.port).request_get(url.path)
    res.code == '500' ? nil : JSON.parse(res.body)
  end
end
