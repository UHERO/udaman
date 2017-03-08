class SeriesController < ApplicationController
  include Authorization

  before_action :check_authorization, except: [:index]

  # GET /series/new
  def new
    @series = Series.new
  end

  # GET /series/bulk
  def bulk_new
  end

  # POST /series
  def create
    @series = Series.new(series_params)

    if @series.save
      redirect_to @series, notice: 'Series was successfully created.'
    else
      render :new
    end
  end

  # POST /series/bulk
  def bulk_create
    if Series.bulk_create params[:definitions].split(/\n+/).map{|dfn| dfn.strip }
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
    frequency = params.has_key?(:freq) ? params[:freq] : nil
    prefix = params.has_key?(:prefix) ? params[:prefix] : nil
    all = params.has_key?(:all) ? true : false

    @all_series = Series.all.order(:name) if all
    @all_series = Series.where(:frequency => frequency).order :name unless frequency.nil?
    @all_series = Series.where('name Like ?', "#{prefix}%").order :name unless prefix.nil?
    # @all_series = Series.all(:conditions => ["name LIKE ?", "#{prefix}%"], :order => :name) unless prefix.nil?
    @all_series ||= [] 
  end

  def show
    @series = Series.find_by id: params[:id]
    @as = AremosSeries.get @series.name 
    @chg = @series.annualized_percentage_change params[:id]
    @ytd_chg = @series.ytd_percentage_change params[:id]
    @lvl_chg = @series.absolute_change params[:id]
    @desc = @as.nil? ? 'No Aremos Series' : @as.description
    
    respond_to do |format|
      format.csv { render :layout => false }
      format.html # show.html.erb
      format.json { render :json => @series }
    end
  end

  def no_source
    @series = Series.where('source_id IS NULL').order(:name).paginate(page: params[:page], per_page: 50)
  end

  def no_source_no_restrict
    @series = Series.where('source_id IS NULL and restricted = false').order(:name).paginate(page: params[:page], per_page: 50)
  end

  def quarantine
    @series = Series.where(quarantined: true, restricted: false).order(:name).paginate(page: params[:page], per_page: 50)
  end

  def add_to_quarantine
    @series = Series.find_by id: params[:id]
    @series.update! quarantined: true
    redirect_to action: :show, id: params[:id]
  end

  def remove_from_quarantine
    next_action = params[:next_action] || :show
    @series = Series.find_by id: params[:id]
    @series.update! quarantined: false
    redirect_to action: next_action, id: params[:id]
  end

  def empty_quarantine
    Series.update_all quarantined: false
    redirect_to action: :quarantine
  end

  def json_with_change
    @series = Series.find_by id: params[:id]
    render :json => { :series => @series, :chg => @series.annualized_percentage_change}
  end
  
  def show_forecast
    @series = Series.find_by id: params[:id]
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
    @series = Series.find_by id: params[:id]
  end
  
  def update    
    @series = Series.find_by id: params[:id]
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
    Series.find_by(id: params[:id]).aremos_match
    redirect_to :action => 'show', id: params[:id]
  end

  def destroy
    @series = Series.find_by id: params[:id]
    @series.destroy
    
    redirect_to :action => 'index'
  end
  
  def search
    @search_results = AremosSeries.web_search(params[:search])
  end
  
  def autocomplete_search
    #render :json => {"hi" => params[:term]}
    render :json => (Series.web_search(params[:term]).map {|s| {:label => (s[:name] + ':' + s[:description]), :value => s[:series_id] } })
    #render :json => Series.web_search(params[:term]).map {|s| s[:name] }
  end

  def comparison_graph
    @series = Series.find_by id: params[:id]
    @comp = @series.aremos_data_side_by_side
  end

  def outlier_graph
    @series = Series.find_by id: params[:id]
    @comp = @series.ma_data_side_by_side
    #residuals is actually whole range of values.
    residuals = @comp.map { |_, ma_hash| ma_hash[:udaman] }
    residuals.reject!{|a| a.nil?}
    average = residuals.inject{ |sum, el| sum + el }.to_f / residuals.count
    @std_dev = Math.sqrt((residuals.inject(0){ | sum, x | sum + (x - average) ** 2 }) / (residuals.count - 1))
  end
  
  def all_tsd_chart
    @series = Series.find_by id: params[:id]
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
    @series = Series.find_by id: params[:id]
  end
  
  def blog_graph
    @series = Series.find_by id: params[:id]
    @start_date = params[:start_date]
    @end_date = params[:end_date]
    chart_to_make = params[:create_post]
    unless chart_to_make.nil?
      @link = chart_to_make == 'line' ? @series.create_blog_post(nil, @start_date, @end_date) : @series.create_blog_post(chart_to_make, @start_date, @end_date)
    end
    @chart_made = chart_to_make
  end
  
  def validate
    @series = Series.find_by id: params[:id]
    @prognoz_data_results = @series.prognoz_data_results
  end
  
  def replace_block
    render :partial => 'replace_block'
  end
  
  def toggle_units
    @series = Series.find_by id: params[:id]
    @series.units = params[:units]
    #@series.save
    @series.aremos_comparison(true)
    @as = AremosSeries.get @series.name
    render :partial => 'toggle_units.html'
  end
  
  def render_data_points
    @series = Series.find_by id: params[:id]
    
    render :partial => 'data_points', :locals => {:series => @series, :as => @as}
  end
  
  def toggle_multiplier
    @series = Series.find_by id: params[:id]
    @series.toggle_mult
    #@series.save
    @output_file = PrognozDataFile.find_by id: @series.prognoz_data_file_id
    @output_file.update_series_validated_for @series
    render :partial => 'validate_row'
  end

  def update_notes
    @series = Series.find_by id: params[:id]
    @series.update_attributes({:investigation_notes => params[:note]})
    render :partial => 'investigation_sort.html'
  end

  def stale
    @stale_series = Series.joins(:data_sources).where('last_run_in_seconds < ?', Time.now.days_ago(2).to_i).pluck(:id, :name)
  end

  private
    def series_params
      params.require(:series).permit(
          :name,
          :description,
          :units,
          :investigation_notes,
          :dataPortalName,
          :unitsLabel,
          :unitsLabelShort,
          :seasonally_adjusted,
          :percent,
          :real,
          :frequency_transform,
          :restricted,
          :source_id,
          :source_link,
          :source_detail_id
      )
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
