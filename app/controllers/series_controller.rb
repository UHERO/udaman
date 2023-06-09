class SeriesController < ApplicationController
  include Authorization
  include Validators

  before_action :check_authorization, except: [:index]
  before_action :set_series,
        only: [:show, :edit, :update, :destroy, :new_alias, :alias_create, :analyze, :add_to_quarantine, :remove_from_quarantine,
               :reload_all, :rename, :save_rename, :duplicate, :save_duplicate, :json_with_change, :show_forecast, :all_tsd_chart,
               :render_data_points, :update_notes, :clear, :do_clear]

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

  def duplicate
  end

  def save_duplicate
    new_name = params[:new_name].strip
    dup_series = @series.duplicate(new_name)
    if params[:copy_loaders] == 'yes'
      @series.enabled_loaders.each do |ld|
        new_ld = ld.dup
        dup_series.loaders << new_ld
      end
    end
    redirect_to edit_series_path(dup_series)
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
      redirect_to controller: :measurements, action: :add_series, id: mid, series_id: @series
    else
      redirect_to @series, notice: 'Alias series successfully created'
    end
  end

  def update
    begin
      @series.update!(series_params)
      mid = params[:add2meas].to_i
      if mid > 0
        redirect_to controller: :measurements, action: :add_series, id: mid, series_id: @series
        return
      end
      respond_to do |format|
        format.html { redirect_to(@series, notice: 'Series successfully updated') }
        format.xml  { head :ok }
      end
    rescue => e
      redirect_to({ action: :edit }, notice: e.message)
      return
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
    all_series = current_user.series.reload
    @clip_empty = all_series.nil? || all_series.empty?
    @all_series = create_index_structure(all_series)
    @sortby = params[:sortby].blank? ? 'name' : params[:sortby]
    @dir = params[:dir].blank? ? 'up' : params[:dir]
    sortby = @sortby.to_sym
    beg_of_time = Date.new(1000)
    @all_series.sort! do |a, b|
      a_sort = a[sortby] || beg_of_time  ## Default to very old date, because First & Last should be the only
      b_sort = b[sortby] || beg_of_time  ## sortable columns that can be nil in the index structure. Kinda yuck but whatever
      cmp = @dir == 'up' ? a_sort <=> b_sort : b_sort <=> a_sort
      next cmp if cmp != 0  ## early return from yielded block
      @dir == 'up' ? a[:name] <=> b[:name] : b[:name] <=> a[:name]
    end
    @index_action = :clip
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
      results = Series.search_box(params[:search], limit: 500, user: current_user)
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
    if params[:clip_action] == 'datatsd'
      redirect_to action: :group_export, type: params[:clip_action], format: :tsd, layout: false
      return
    end
    if params[:clip_action] == 'meta_update'
      redirect_to action: :meta_update
      return
    end
    @status_message = current_user.do_clip_action(params[:clip_action])
    clipboard
  end

  def group_export
    @type = params[:type]
    @all_series = current_user.series.reload.sort_by(&:name)
  end

  def meta_update
    @meta_update = true
    all_series = current_user.series.reload.sort_by(&:name)
    @all_series = create_index_structure(all_series)
    @sortby = ''
    @dir = 'up'
    @index_action = :meta_update
    @series = Series.new(universe: 'UHERO', name: 'Metadata update', xseries: Xseries.new)
    set_attrib_resource_values(@series)
  end

  def meta_store
    fields = field_params.to_h.keys.map(&:to_sym)
    unless fields.count > 0
      redirect_to({ action: :meta_update }, notice: 'No fields were specified for metadata propagation')
      return
    end
    new_properties = fields.map {|f| [f, series_params[f] || series_params[:xseries_attributes][f] ] }.to_h
    current_user.meta_update(new_properties)
    redirect_to action: :clipboard
  end

  def clear
  end

  def do_clear
    cutoff_date = clear_params[:date].nil_blank  ## will be nil when all points are to be cleared
    delete_method_param = {}
    if cutoff_date
      if clear_params[:type].blank?
        redirect_to action: :clear, id: @series
        return
      end
      delete_method_param = { clear_params[:type].to_sym => cutoff_date }
    end
    @series.delete_data_points(**delete_method_param)  ## double splat for hash
    @series.repair_currents!
    redirect_to controller: :series, action: :show, id: @series
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
    all_series = Series.get_all_uhero.order(created_at: :desc).limit(40)
    @all_series = create_index_structure(all_series)
    @sortby = ''
    @dir = 'up'
    @index_action = :index
  end

  def autocomplete_search
    render :json => Series.web_search(params[:term], params[:universe])
                          .map {|s| { label: s[:name] + ':' + s[:description], value: s[:series_id] } }
  end

  def new_search(search_string = nil)
    @search_string = search_string || helpers.url_decode(params[:search_string])
    Rails.logger.info { "SEARCHLOG: user #{current_user.username.ljust(9, ' ')} searched #{@search_string}" }
    all_series = Series.search_box(@search_string, limit: ENV['SEARCH_DEFAULT_LIMIT'].to_i, user: current_user)
    if all_series.count == 1 && @search_string !~ /[+]1\b/
      redirect_to action: :show, id: all_series[0]
      return
    end
    @all_series = create_index_structure(all_series)
    @b64_search_str = helpers.url_encode(@search_string)
    @sortby = params[:sortby].blank? ? 'name' : params[:sortby]
    @dir = params[:dir].blank? ? 'up' : params[:dir]
    unless @sortby == 'name' && @dir == 'up'  ## Only bother sorting if other than name/up, as search_box() already does that
      sortby = @sortby.to_sym
      beg_of_time = Date.new(1000)
      @all_series.sort! do |a, b|
        a_sort = a[sortby] || beg_of_time  ## Default to very old date, because First & Last should be the only
        b_sort = b[sortby] || beg_of_time  ## sortable columns that can be nil in the index structure. Kinda yuck but whatever
        cmp = @dir == 'up' ? a_sort <=> b_sort : b_sort <=> a_sort
        next cmp if cmp != 0  ## early return from yielded block
        @dir == 'up' ? a[:name] <=> b[:name] : b[:name] <=> a[:name]
      end
    end
    @index_action = :search
    render :index
  end

  def show(no_render: false)
    @desc = AremosSeries.get(@series.name).description rescue 'No Aremos Series'
    @vintage = Date.parse(params[:vintage]) rescue nil
    @chg = @series.annualized_percentage_change params[:id]
    @ytd_chg = @series.ytd_percentage_change params[:id]
    @lvl_chg = @series.absolute_change params[:id]
    @dsas = @series.enabled_loaders.map {|ld| ld.loader_actions }.flatten
    @clipboarded = current_user.clipboard.include?(@series)
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

  def csv2tsd_upload
  end

  def csv2tsd
    @filepath = csv2tsd_params[:filepath]

    respond_to do |format|
      format.tsd { send_data helpers.do_csv2tsd_convert(@filepath),
                             filename: @filepath.original_filename.change_file_extension('tsd', nopath: true),
                             type: 'application/tsd',
                             disposition: 'attachment' }
    end
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
    @freq = params[:freq] = forecast_upload_params[:freq].nil_blank
    if @path =~ /(\d\dQ\d+)([FH](\d+|F))(_([ASQM])[^A-Z])?/i
      @fcid = params[:fcid] ||= $1.upcase        ## explicitly entered fcid/version/freq override
      @version = params[:version] ||= $2.upcase  ## those scraped from the filename
      @freq = params[:freq] ||= $5.upcase if $5
    end
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

  def destroy
    @series.destroy!
    redirect_to action: :index
  end
  
  def search
    @search_results = AremosSeries.web_search(params[:search])
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
    eval_statement = eval_string.split(' ').map {|e| valid_series_name(e) ? %Q{"#{e}".ts} : e }.join(' ')
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
    @chg = @series.annualized_percentage_change
    @as = AremosSeries.get @series.name
    @desc = @as.nil? ? "No Aremos Series" : @as.description
    @lvl_chg = @series.absolute_change
    @ytd = @series.ytd_percentage_change
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later (also :only ref at top of file)
  def render_data_points_DELETEME?
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
          :fields_selected,
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

  def field_params
    all_attribs = Series.attribute_names + Xseries.attribute_names
    params.require(:fields_selected).permit(all_attribs.map(&:to_sym))
  end

  def forecast_upload_params
    params.require(:forecast_upload).permit(:fcid, :version, :freq, :filepath)
  end

  def csv2tsd_params
    params.require(:csv2tsd).permit(:filepath)
  end

  def clear_params
    params.require(:clear_op).permit(:date, :type)
  end

  def set_series
    @series = Series.find params[:id]
  end

  def create_index_structure(series_list)
    series_list.map do |s|
      name_parts = s.parse_name
      { series_obj: s,
        name: s.name,
        geo: name_parts[:geo],
        freq: name_parts[:freq_long].freqn,
        sa: s.seasonal_adjustment,
        portalname: s.dataPortalName.to_s,  ## need to_s because it could be nil
        restricted: s.restricted?,
        unit_short: s.unit && s.unit.short_label,
        unit_long:  s.unit && s.unit.long_label,
        first: DataPoint.where(xseries_id: s.xseries_id).minimum(:date),
         last: DataPoint.where(xseries_id: s.xseries_id).maximum(:date),
        source_id: s.source && s.source.id,
        source: (s.source.description rescue '')  ## need rescue because it's a sort column and could be nil
      }
    end
  end

  def set_attrib_resource_values(series)
    primary_univ = series.has_primary? ? series.primary_series.universe : 'UHERO'
    @all_geos = Geography.where(universe: series.universe)
    if @all_geos.empty?
      raise "Universe #{series.universe} has no geographies of its own"
    end
    @all_units = Unit.where(universe: series.universe)
    @all_units = Unit.where(universe: primary_univ) if @all_units.empty?
    @all_units = Unit.where(universe: 'UHERO')      if @all_units.empty?
    @all_sources = Source.where(universe: series.universe)
    @all_sources = Source.where(universe: primary_univ) if @all_sources.empty?
    @all_sources = Source.where(universe: 'UHERO')      if @all_sources.empty?
    @all_details = SourceDetail.where(universe: series.universe)
    @all_details = SourceDetail.where(universe: primary_univ) if @all_details.empty?
    @all_details = SourceDetail.where(universe: 'UHERO')      if @all_details.empty?
  end

  def json_from_heroku_tsd(series_name, tsd_file)
    url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{series_name[0..-3]}/json")
    res = Net::HTTP.new(url.host, url.port).request_get(url.path)
    res.code == '500' ? nil : JSON.parse(res.body)
  end
end
