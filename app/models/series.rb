class Series < ApplicationRecord
  include Cleaning
  include SeriesArithmetic
  include SeriesAggregation
  include SeriesComparison
  include SeriesSeasonalAdjustment
  include SeriesSharing
  include SeriesDataAdjustment
  include SeriesInterpolation
  include SeriesExternalRelationship
  include SeriesRelationship
  include SeriesSpecCreation
  include SeriesDataLists
  include SeriesStatistics
  include Validators

  validates :name, presence: true, uniqueness: { scope: :universe }
  validate :source_link_is_valid
  before_destroy :last_rites, prepend: true
  after_destroy :post_mortem, prepend: true

  belongs_to :xseries, inverse_of: :series
  accepts_nested_attributes_for :xseries
  delegate_missing_to :xseries  ## methods that Series does not 'respond_to?' are tried against the contained Xseries

  has_many :data_sources, inverse_of: :series, dependent: :destroy

  has_and_belongs_to_many :data_lists

  belongs_to :source, optional: true, inverse_of: :series
  belongs_to :source_detail, optional: true, inverse_of: :series
  belongs_to :unit, optional: true, inverse_of: :series
  belongs_to :geography, inverse_of: :series

  has_many :export_series, dependent: :delete_all
  has_many :exports, through: :export_series
  has_many :measurement_series, dependent: :delete_all
  has_many :measurements, through: :measurement_series

  enum seasonal_adjustment: { not_applicable: 'not_applicable',
                              seasonally_adjusted: 'seasonally_adjusted',
                              not_seasonally_adjusted: 'not_seasonally_adjusted' }

  ## this action can probably be eliminated after implementing a more comprehensive way of updating neglected
  ## columns/attributes based on heuristics over other attributes in the model.
  after_create do
    unless frequency
      self.update(frequency: self.frequency_from_name)
    end
  end

  def to_s
    self.name || 'UNNAMED_SERIES'
  end

  def first_observation
    data.reject {|_,val| val.nil? }.keys.sort[0] rescue nil
  end

  def last_observation
    data.reject {|_,val| val.nil? }.keys.sort[-1] rescue nil
  end

  def Series.get_all_uhero
    Series.get_all_universe('UHERO')
  end

  def Series.get_all_universe(universe)
    Series.joins(:xseries).where(universe: universe)
  end

  def Series.all_names
    Series.get_all_uhero.pluck(:name)
  end

  def Series.get(name, universe = 'UHERO')
    Series.parse_name(name) && Series.where(universe: universe, name: name).first
  end

  def Series.get_or_new(series_name, universe = 'UHERO')
    Series.get(series_name, universe) || Series.create_new(universe: universe, name: series_name)
  end

  def Series.bulk_create(definitions)
    definitions.each { |definition| Kernel::eval definition }
    return true
  end

  def Series.create_new(properties)
    ## :xseries_attributes and :name_parts only present when called from SeriesController#create
    xs_attrs = properties.delete(:xseries_attributes)
    if xs_attrs
      properties.merge!(xs_attrs)
    end
    name_parts = properties.delete(:name_parts)
    if name_parts
      properties.merge!(name_parts)
    else
      name_parts = Series.parse_name(properties[:name])
    end

    if properties[:geography_id]
      geo = Geography.find properties[:geography_id]
    else
      uni = properties[:universe] || 'UHERO'
      geo = Geography.find_by(universe: uni, handle: name_parts[:geo]) || raise("No #{uni} Geography found, handle=#{name_parts[:geo]}")
    end
    properties[:name] ||= Series.build_name(name_parts[:prefix], geo.handle, name_parts[:freq])
    properties[:geography_id] ||= geo.id
    properties[:frequency] ||= Series.frequency_from_code(name_parts[:freq]) || raise("Unknown freq=#{name_parts[:freq]} in series creation")

    series_attrs = Series.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }  ## no direct creation of Rails timestamps. right?
    series_props = properties.select{|k, _| series_attrs.include? k.to_s }
    xseries_attrs = Xseries.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }
    xseries_props = properties.select{|k, _| xseries_attrs.include? k.to_s }
    s = nil
    begin
      self.transaction do
        x = Xseries.create!(xseries_props)
        s = Series.create!(series_props.merge(xseries_id: x.id))
        x.update(primary_series_id: s.id)
      end
    rescue => e
      raise "Model object creation failed for name #{properties[:name]}: #{e.message}"
    end
    s
  end

  ## NOTE: Overriding an important ActiveRecord core method!
  def update(attributes)
    xs_attrs = attributes.delete(:xseries_attributes)
    if xs_attrs
      attributes.merge!(xs_attrs)
    end
    series_attrs = Series.attribute_names.reject{|a| a == 'id' || a == 'universe' || a =~ /ted_at$/ } ## no direct update of Rails timestamps
    xseries_attrs = Xseries.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }
    begin
      with_transaction_returning_status do
        assign_attributes(attributes.select{|k,_| series_attrs.include? k.to_s })
        save
        xseries.update(attributes.select{|k,_| xseries_attrs.include? k.to_s })
      end
    rescue => e
      raise "Model object update failed for Series #{name} (id=#{id}): #{e.message}"
    end
  end

  alias update_attributes update

  ## NOTE: Overriding an important ActiveRecord core method!
  def update!(attributes)
    xs_attrs = attributes.delete(:xseries_attributes)
    if xs_attrs
      attributes.merge!(xs_attrs)
    end
    series_attrs = Series.attribute_names.reject{|a| a == 'id' || a == 'universe' || a =~ /ted_at$/ } ## no direct update of Rails timestamps
    xseries_attrs = Xseries.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }
    begin
      with_transaction_returning_status do
        assign_attributes(attributes.select{|k,_| series_attrs.include? k.to_s })
        save!
        xseries.update!(attributes.select{|k,_| xseries_attrs.include? k.to_s })
      end
    rescue => e
      raise "Model object update! failed for Series #{name} (id=#{id}): #{e.message}"
    end
  end

  alias update_attributes! update!

  def Series.parse_name(string)
    if string =~ /^(\S+?)@(\w+?)\.([ASQMWD])$/i
      return { prefix: $1, geo: $2, freq: $3.upcase }
    end
    raise SeriesNameException, "Invalid series name format: #{string}"
  end

  def parse_name
    Series.parse_name(self.name)
  end

  def Series.build_name(prefix, geo, freq)
    name = prefix.strip.upcase + '@' + geo.strip.upcase + '.' + freq.strip.upcase
    Series.parse_name(name) && name
  end

  ## Build a new name starting from mine, and replacing whatever parts are passed in
  def build_name(new_parts)
    name = self.parse_name.merge(new_parts)
    Series.build_name(name[:prefix], name[:geo], name[:freq])
  end

  ## Find NS@ correspondent series
  def find_ns_series
    self.build_name(prefix: self.parse_name[:prefix] + 'NS').ts
  end

  ## Find non-NS@ correspondent series
  def find_non_ns_series
    self.build_name(prefix: self.parse_name[:prefix].sub(/NS$/i,'')).ts
  end

  ## Find "sibling" series for a different geography
  def find_sibling_for_geo(geo)
    self.build_name(geo: geo.upcase).ts
  end

  ## Find "sibling" series for a different frequency
  def find_sibling_for_freq(freq)
    self.build_name(freq: freq.upcase).ts
  end

  def is_primary?
    xseries.primary_series === self
  end

  def has_primary?
    xseries.primary_series
  end

  def aliases
    Series.where('xseries_id = ? and id <> ?', xseries_id, id)
  end

  def create_alias(parameters)
    universe = parameters[:universe] || raise('Universe must be specified to create alias')
    raise "#{self} is not a primary series, cannot be aliased" unless is_primary?
    raise "Cannot duplicate #{self} into same universe #{universe}" if universe == self.universe
    new_geo = Geography.find_by(universe: universe, handle: geography.handle)
    raise "No geography #{geography.handle} exists in universe #{universe}" unless new_geo
    new = self.dup
    new.assign_attributes(parameters.merge(geography_id: new_geo.id))
    new.save!
    new.xseries.update!(primary_series_id: self.id)  ## just for insurance
    new
  end

  ## Duplicate series for a different geography.
  ## This won't work with the new Xseries architecture, but maybe is not needed anymore.
  ## Was only used for a one-off job. If needed again, refactor carefully.
  def dup_series_for_geo_DONTUSE(geo)
    sib = find_sibling_for_geo(geo)
    raise "Series #{sib.name} already exists" if sib
    name = self.parse_name
    new = self.dup
    new.update(
        geography_id: Geography.get(universe: universe, handle: geo).id, ## raises err if geo does not exist
        name: Series.build_name(name[:prefix], geo, name[:freq])
    ## future/next time: the dataPortalName also needs to be copied over (with mods?)
    )
    new.save!
    self.data_sources.each do |ds|
      new_ds = ds.dup
      if new_ds.save!
        new_ds.update!(last_run_at: nil, last_run_in_seconds: nil, last_error: nil, last_error_at: nil)
        new.data_sources << new_ds
        new_ds.reload_source
      end
    end
    new
  end

  def Series.handle_buckets(series_array, handle_hash)
    series_array_buckets = {}
    series_array.each do |s|
      handle = handle_hash[s.id]
      #next if handle.nil?
      series_array_buckets[handle] ||= []
      series_array_buckets[handle].push(s)
    end
    return series_array_buckets
  end
  
  #takes about 8 seconds to run for month, but not bad
  #chart both last updated and last observed (rebucket?)
  def Series.last_observation_buckets(frequency)
    obs_buckets = {}
    mod_buckets = {}
    results = Series.get_all_uhero.where('frequency = ?', frequency).select('data, updated_at')
    results.each do |s|
      last_date = s.last_observation.nil? ? 'no data' : s.last_observation[0..6]
      last_update = s.updated_at.nil? ? 'never' : s.updated_at.to_date.to_s[0..6] #.last_updated.nil?
      obs_buckets[last_date] ||= 0
      obs_buckets[last_date] += 1
      mod_buckets[last_update] ||= 0
      mod_buckets[last_update] += 1      
    end
    {:last_observations => obs_buckets, :last_modifications => mod_buckets}
  end
  
  def Series.region_hash
    region_hash = {}
    all_names = Series.get_all_uhero.all_names
    all_names.each do |name|
      next if name.nil?
      suffix = name.split('@')[1]
      region = suffix.nil? ? '' : suffix.split('.')[0]
      region_hash[region] ||= []
      region_hash[region].push(name)
    end
    region_hash
  end
  
  def Series.frequency_hash
    frequency_hash = {}
    all_names = Series.get_all_uhero.select('name, frequency')
    all_names.each do |s|
      frequency_hash[s.frequency] ||= []
      frequency_hash[s.frequency].push(s.name)
    end
    frequency_hash
  end
  
  def Series.frequency_counts
    frequency_counts = Series.frequency_hash
    frequency_counts.each {|key,value| frequency_counts[key] = value.count}
    frequency_counts
  end
  
  def Series.region_counts
    region_counts = Series.region_hash
    region_counts.each {|key,value| region_counts[key] = value.count}
    region_counts
  end
  
  
  def Series.code_from_frequency(frequency)
    return 'A' if frequency == :year || frequency == 'year' || frequency == :annual || frequency == 'annual' || frequency == 'annually'
    return 'Q' if frequency == :quarter || frequency == 'quarter' || frequency == 'quarterly'
    return 'M' if frequency == :month || frequency == 'month' || frequency == 'monthly'
    return 'S' if frequency == :semi || frequency == 'semi' || frequency == 'semi-annually'
    return 'W' if frequency == :week || frequency == 'week' || frequency == 'weekly'
    return 'D' if frequency == :day || frequency == 'day' || frequency == 'daily'
    
    return ''
  end
  
  def Series.frequency_from_code(code)
    case code && code.upcase
      when 'A' then :year
      when 'Q' then :quarter
      when 'M' then :month
      when 'S' then :semi
      when 'W' then :week
      when 'D' then :day
      else nil
    end
  end

  def Series.frequency_from_name(name)
    Series.frequency_from_code(Series.parse_name(name)[:freq])
  end

  def frequency_from_name
    Series.frequency_from_name(self.name)
  end

  def Series.each_spreadsheet_header(spreadsheet_path, sheet_to_load = nil, sa = false)
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)
    if update_spreadsheet.load_error?
      return {:message => 'The spreadsheet could not be found', :headers => []}
    end

    unless update_spreadsheet.class == UpdateCSV
      default_sheet = sa ? 'sadata' : update_spreadsheet.sheets.first
      update_spreadsheet.default_sheet = sheet_to_load.nil? ? default_sheet : sheet_to_load 
    end
    unless update_spreadsheet.update_formatted?
      return {:message=>'The spreadsheet was not formatted properly', :headers=>[]}
    end

    header_names = Array.new    
     
    update_spreadsheet_headers = sa ? update_spreadsheet.headers.keys : update_spreadsheet.headers_with_frequency_code 
    update_spreadsheet_headers.each do |series_name|
      header_names.push(yield series_name, update_spreadsheet)
    end
    
    sheets = update_spreadsheet.class == UpdateCSV ? [] : update_spreadsheet.sheets
    return {:message=>'success', :headers=>header_names, :sheets => sheets}
  end
  
  def Series.load_all_sa_series_from(spreadsheet_path, sheet_to_load = nil)  
    each_spreadsheet_header(spreadsheet_path, sheet_to_load, true) do |series_name, update_spreadsheet|
      frequency_code = code_from_frequency update_spreadsheet.frequency  
      sa_base_name = series_name.sub('NS@','@')
      sa_series_name = sa_base_name+'.'+frequency_code
      Series.store(sa_series_name, Series.new(:frequency => update_spreadsheet.frequency, :data => update_spreadsheet.series(series_name)), spreadsheet_path, %Q^"#{sa_series_name}".tsn.load_sa_from "#{spreadsheet_path}", "#{sheet_to_load}"^) unless sheet_to_load.nil? 
      Series.store(sa_series_name, Series.new(:frequency => update_spreadsheet.frequency, :data => update_spreadsheet.series(series_name)), spreadsheet_path, %Q^"#{sa_series_name}".tsn.load_sa_from "#{spreadsheet_path}"^) if sheet_to_load.nil?
      #sa_series_name.ts.update_attributes(:seasonally_adjusted => true, :last_demetra_datestring => update_spreadsheet.dates.keys.sort.last)
      
      sa_series_name
    end
  end

  def Series.load_all_series_from(spreadsheet_path, sheet_to_load = nil, priority = 100)
    t = Time.now
    each_spreadsheet_header(spreadsheet_path, sheet_to_load, false) do |series_name, update_spreadsheet|
      eval_format = sheet_to_load ? '"%s".tsn.load_from "%s", "%s"' : '"%s".tsn.load_from "%s"'
      @data_source = Series.store(series_name,
                                  Series.new(frequency: update_spreadsheet.frequency, data: update_spreadsheet.series(series_name)),
                                  spreadsheet_path,
                                  eval_format % [series_name, spreadsheet_path, sheet_to_load])

      @data_source.update_attributes(:priority => priority)
      series_name
    end
    puts "#{'%.2f' % (Time.now - t)} : #{spreadsheet_path}"
  end
  
  def Series.store(series_name, series, desc=nil, eval_statement=nil, priority=100)
    desc = series.name if desc.nil?
    desc = 'Source Series Name is blank' if desc.blank?
    series_to_set = series_name.tsn
    series_to_set.frequency = series.frequency
    series_to_set.save_source(desc, eval_statement, series.data, priority)
  end

  def Series.eval(series_name, eval_statement, priority=100)
    new_series = Kernel::eval eval_statement
    Series.store series_name, new_series, new_series.name, eval_statement, priority
  end

  def save_source(source_desc, eval_statement, data, priority = 100)
    source = nil
    now = Time.now
    if eval_statement
      eval_statement.strip!
      data_sources.each do |ds|
        if ds.eval && ds.eval.strip == eval_statement
          ds.update_attributes(last_run: now)
          source = ds
        end
      end
    end

    if source.nil?
      source = data_sources.create(
        :description => source_desc,
        :eval => eval_statement,
        :priority => priority,
        :last_run => now
      )
      source.setup
    end
    update_data(data, source, false)
    source
  end

  def data_sources_sort_for_display
    ## Non-nightlies at the top, then sort by priority, then by id within priority groups.
    data_sources.sort_by {|ds| [(ds.reload_nightly ? 1 : 0), ds.priority, ds.id] }
    ## For some reason, sort_by does not take the reload_nightly boolean attribute as-is,
    ## but it needs to be "reconverted" to integer - I am mystified by this.
  end

  def update_data(data, source, run_update = true)
    #removing nil dates because they incur a cost but no benefit.
    #have to do this here because there are some direct calls to update data that could include nils
    #instead of calling in save_source
    data.delete_if {|_,value| value.nil?}

    # make sure data keys are in Date format
    formatted_data = {}
    data.each_pair {|date, value| formatted_data[Date.parse date.to_s] = value}
    data = formatted_data
    observation_dates = data.keys
    current_data_points.each do |dp|
      dp.upd(data[dp.date], source)
    end
    observation_dates -= current_data_points.map(&:date)
    now = Time.now
    observation_dates.each do |date|
      xseries.data_points.create(
        :date => date,
        :value => data[date],
        :created_at => now,
        :current => true,
        :data_source_id => source.id
      )
    end
    DataPoint.update_public_data_points(universe, self) if run_update
    aremos_comparison #if we can take out this save, might speed things up a little
    true
  end

  def add_to_quarantine(run_update = true)
    self.update! quarantined: true
    DataPoint.update_public_data_points(universe, self) if run_update
  end

  def remove_from_quarantine(run_update = true)
    raise 'Trying to remove unquarantined series from quarantine' unless quarantined?
    self.update! quarantined: false
    DataPoint.update_public_data_points(universe, self) if run_update
  end

  def Series.empty_quarantine
    Series.get_all_uhero.where('quarantined = true').update_all quarantined: false
    DataPoint.update_public_data_points(universe)
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def update_data_hash_DELETEME
    data_hash = {}
    xseries.data_points.each do |dp|
      data_hash[dp.date.to_s] = dp.value if dp.current
    end
    self.save
  end
  
  def data
    @data ||= extract_from_datapoints('value')
  end
  
  def data=(data_hash)
    @data = data_hash
  end

  def yoy_hash
    @yoy_hash ||= extract_from_datapoints('yoy')
  end

  def ytd_hash
    @ytd_hash ||= extract_from_datapoints('ytd')
  end

  def change_hash
    @change_hash ||= extract_from_datapoints('change')
  end

  def trim_period_start
    @trim_period_start
  end

  def trim_period_end
    @trim_period_end
  end

  def trim_period_start=(date)
    @trim_period_start = date
  end

  def trim_period_end=(date)
    @trim_period_end = date
  end

  def extract_from_datapoints(column)
    hash = {}
    if xseries
      xseries.data_points.each do |dp|
        hash[dp.date] = dp[column] if dp.current
      end
    end
    hash
  end
  
  def scaled_data_no_pseudo_history(round_to = 3)
    data_hash = {}
    self.units ||= 1
    self.units = 1000 if name[0..2] == 'TGB' #hack for the tax scaling. Should not save units
    xseries.data_points.each do |dp|
      data_hash[dp.date] = (dp.value / self.units).round(round_to) if dp.current and !dp.pseudo_history?
    end
    data_hash
  end
  
  def scaled_data(round_to = 3)
    data_hash = {}
    self.units ||= 1
    self.units = 1000 if name[0..2] == 'TGB' #hack for the tax scaling. Should not save units
    sql = <<~SQL
      SELECT round(value/#{self.units}, #{round_to}) AS value, date
      FROM data_points WHERE xseries_id = #{self.xseries.id} AND current = 1;
    SQL
    ActiveRecord::Base.connection.execute(sql).each(:as => :hash) do |row|
      data_hash[row['date']] = row['value']
    end
    data_hash
  end

  def Series.new_transformation(name, data, frequency)
    ## this class method now only exists as a wrapper because there are still a bunch of calls to it out in the wild.
    Series.new.new_transformation(name, data, frequency)
  end
  
  def new_transformation(name, data, frequency = nil)
    raise "Undefined dataset for new transformation '#{name}'" if data.nil?
    frequency = Series.frequency_from_code(frequency) || frequency || self.frequency || Series.frequency_from_name(name)
    Series.new(
      :name => name,
      :xseries => Xseries.new(frequency: frequency),
      :data => Hash[data.reject {|_, v| v.nil? }.map {|date, value| [Date.parse(date.to_s), value] }]
    ).tap do |o|
      o.propagate_state_from(self)
    end
  end

  def propagate_state_from(series_obj)
    self.trim_period_start = series_obj.trim_period_start
    self.trim_period_end = series_obj.trim_period_end
  end

  def load_from(spreadsheet_path, sheet_to_load = nil)
    spreadsheet_path.gsub! ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH']
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)
    raise SeriesReloadException, 'load error' if update_spreadsheet.load_error?
    #return self if update_spreadsheet.load_error?

    unless update_spreadsheet.class == UpdateCSV
      update_spreadsheet.default_sheet = sheet_to_load || update_spreadsheet.sheets.first
    end
    raise SeriesReloadException, 'update not formatted' unless update_spreadsheet.update_formatted?
    #return self unless update_spreadsheet.update_formatted?
    
    self.frequency = update_spreadsheet.frequency
    new_transformation(spreadsheet_path, update_spreadsheet.series(self.name))
  end

  def load_sa_from(spreadsheet_path, sheet_to_load = 'sadata')
    spreadsheet_path.gsub! ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH']
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)

    if update_spreadsheet.load_error? || !update_spreadsheet.update_formatted?
      ##raise SeriesReloadException
      return self
    end
    unless update_spreadsheet.class == UpdateCSV
      update_spreadsheet.default_sheet = sheet_to_load
    end

    self.frequency = update_spreadsheet.frequency
    ns_name = self.name.sub('@','NS@')
    new_transformation(spreadsheet_path, update_spreadsheet.series(ns_name))
  end
  
  def load_mean_corrected_sa_from(spreadsheet_path, sheet_to_load = 'sadata')
    spreadsheet_path.gsub! ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH']
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)

    if update_spreadsheet.load_error? || !update_spreadsheet.update_formatted?
      ##raise SeriesReloadException
      return self
    end
    unless update_spreadsheet.class == UpdateCSV
      # default_sheet = update_spreadsheet.sheets.first
      update_spreadsheet.default_sheet = sheet_to_load
    end

    ns_series = find_ns_series || raise("No NS series corresponds to #{self}")
    demetra_series = new_transformation('demetra series', update_spreadsheet.series(ns_series.name))
    demetra_series.frequency = update_spreadsheet.frequency.to_s
    self.frequency = update_spreadsheet.frequency
    mean_corrected = demetra_series / demetra_series.annual_sum * ns_series.annual_sum
    new_transformation("mean corrected against #{ns_series} and loaded from #{spreadsheet_path}", mean_corrected.data)
  end

  ## This is for code testing purposes
  def generate_random(start_date, end_date, low_range, high_range)
    freq = self.frequency
    incr = 1
    if freq == 'quarter'
      freq = 'month'
      incr = 3
    end
    series_data = {}
    iter = Date.parse(start_date)
    upto = Date.parse(end_date)
    while iter <= upto do
      series_data[iter] = low_range + rand(high_range - low_range)
      iter += incr.send(freq)
    end
    new_transformation("generated randomly for testing", series_data)
  end

  def Series.load_from_download(handle, options)
    dp = DownloadProcessor.new(handle, options)
    series_data = dp.get_data
    Series.new_transformation("loaded from download #{handle} with options:#{Series.display_options(options)}",
                               series_data,
                               Series.frequency_from_code(options[:frequency]))
  end
  
  def Series.load_from_file(file, options)
    file.gsub! ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH']
    %x(chmod 766 #{file}) unless file.include? '%'
    dp = DownloadProcessor.new('manual', options.merge(:path => file))
    series_data = dp.get_data
    Series.new_transformation("loaded from file #{file} with options:#{Series.display_options(options)}",
                               series_data,
                               Series.frequency_from_code(options[:frequency]))
  end
  
  def load_from_pattern_id(id)
    new_transformation("loaded from pattern id #{id}", {})
  end
  
  def load_from_download(handle, options)
    dp = DownloadProcessor.new(handle, options)
    series_data = dp.get_data
    new_transformation("loaded from download #{handle} with options:#{Series.display_options(options)}", series_data)
  end

  ## This class method used to have a corresponding (redundant) instance method that apparently was never used, so I offed it.
  def Series.load_from_bea(frequency, dataset, parameters)
    series_data = DataHtmlParser.new.get_bea_series(dataset, parameters)
    name = "loaded dataset #{dataset} with parameters #{parameters} from BEA API"
    if series_data.empty?
      name = "No data collected from BEA API for #{dataset} freq=#{frequency} - possibly redacted"
    end
    Series.new_transformation(name, series_data, frequency)
  end
  
  def Series.load_from_bls(code, frequency)
    Series.new.load_from_bls(code, frequency) ##### look into this method: what happens if frequency.nil? and self.data.empty? (CAN it be?)
  end
  
  def load_from_bls(code, frequency = nil)
    series_data = DataHtmlParser.new.get_bls_series(code, frequency)
    name = "loaded series code: #{code} from BLS API"
    if series_data && series_data.empty?
      name = "No data collected from BLS API for #{code} freq=#{frequency} - possibly redacted"
    end
    new_transformation(name, series_data, frequency)
  end

  def Series.load_from_fred(code, frequency = nil, aggregation_method = nil)
    series_data = DataHtmlParser.new.get_fred_series(code, frequency, aggregation_method)
    name = "loaded series: #{code} from FRED API"
    if series_data.empty?
      name = "No data collected from FRED API for #{code} freq=#{frequency} - possibly redacted"
    end
    Series.new_transformation(name, series_data, frequency)
  end

  def Series.load_from_estatjp(code, filters)
    ### Note: Code is written to collect _only_ monthly data!
    series_data = DataHtmlParser.new.get_estatjp_series(code, filters)
    name = "loaded series: #{code} from ESTATJP API"
    if series_data.empty?
      name = "No data collected from ESTATJP API for #{code} freq=M - possibly redacted"
    end
    Series.new_transformation(name, series_data, 'M')
  end

  def Series.load_from_clustermapping(dataset, parameters)
    series_data = DataHtmlParser.new.get_clustermapping_series(dataset, parameters)
    name = "loaded dataset #{dataset} with parameters #{parameters} from Clustermapping API"
    if series_data.empty?
      name = "No data collected from Clustermapping API for #{dataset}"
    end
    Series.new_transformation(name, series_data, 'A')
  end

  def Series.load_from_eia(parameter)
    # Series ID in the EIA API is case sensitive
    series_id = parameter.upcase
    series_data = DataHtmlParser.new.get_eia_series(series_id)
    name = "loaded series with parameters #{series_id} from U.S. EIA API"
    if series_data.empty?
      name = "No data collected from U.S. EIA API for #{series_id}"
    end
    Series.new_transformation(name, series_data, series_id[-1])
  end
  
  def days_in_period
    series_data = {}
    data.each {|date, _| series_data[date] = date.to_date.days_in_period(self.frequency) }
    new_transformation('days in time periods', series_data, self.frequency)
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def Series.where_ds_like_DELETEME(string)
    ds_array = DataSource.where("eval LIKE '%#{string}%'").all
    series_array = []
    ds_array.each do |ds|
      series_array.push ds.series
    end 
    series_array
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def ds_like_DELETEME?(string)
    self.data_sources.each do |ds|
      return true unless ds.eval.index(string).nil?
    end
    false
  end
  
  def handle
    self.data_sources.each do |ds|
      unless ds.eval.index('load_from_download').nil?
        return ds.eval.split('load_from_download')[1].split("\"")[1]
      end
    end
    nil
  end

  def original_url
    self.data_sources.each do |ds|
      unless ds.eval.index('load_from_download').nil?
        return Download.get(ds.eval.split('load_from_download')[1].split("\"")[1]).url
      end
    end
    nil
  end
  
  def at(date)
    data[date]
  end
  
  def units_at(date)
    dd = data[date]
    return nil if dd.nil?
    self.units ||= 1
    dd / self.units
  end
  
  def new_at(date)
    DataPoint.first(:conditions => {:date => date, :current => true, :series_id => self.id})
  end

  def observation_count
    observations = 0
    data.each do |_, value|
      observations += 1 unless value.nil?
    end
    observations
  end

  def new_data?
    xseries.data_points.where('created_at > FROM_DAYS(TO_DAYS(NOW()))').count > 0
  end
  
  #used to use app.get trick
  def create_blog_post(bar = nil, start_date = nil, end_date = nil)
    return unless ((ENV.has_key? 'cms_user') and ENV.has_key? 'cms_pass')

    start_date = start_date.nil? ? (Time.now.to_date << (15)).to_s : start_date.to_s
    end_date = end_date.nil? ? Time.now.to_date.to_s : end_date.to_s
    plot_data = self.get_values_after(start_date,end_date)
    chart_id = self.id.to_s + '_' + Date.today.to_s
    a_series = AremosSeries.get(self.name)
    view = ActionView::Base.new(ActionController::Base.view_paths, {}) 
    
    
    if bar == 'yoy'
      bar_data = self.annualized_percentage_change.data
      bar_id_label = 'yoy'
      bar_color = '#AAAAAA'
      bar_label = 'YOY % Change'
      template_path = 'app/views/series/_blog_chart_line_bar'
      post_body = '' + view.render(:file=> "#{template_path}.html.erb", :locals => {:plot_data => plot_data, :a_series => a_series, :chart_id => chart_id, :bar_id_label=>bar_id_label, :bar_label => bar_label, :bar_color => bar_color, :bar_data => bar_data })
    elsif bar == 'ytd'
      bar_data = self.ytd_percentage_change.data 
      bar_id_label = 'ytd'
      bar_color = '#AAAAAA'
      bar_label = 'YTD % Change'
      template_path = 'app/views/series/_blog_chart_line_bar'
      post_body = '' + view.render(:file=> "#{template_path}.html.erb", :locals => {:plot_data => plot_data, :a_series => a_series, :chart_id => chart_id, :bar_id_label=>bar_id_label, :bar_label => bar_label, :bar_color => bar_color, :bar_data => bar_data })
    else
      template_path = 'app/views/series/_blog_chart_line'
      post_body = '' + view.render(:file=> "#{template_path}.html.erb", :locals => {:plot_data => plot_data, :a_series => a_series, :chart_id => chart_id})
    end

    require 'mechanize'
    agent = Mechanize.new
    login_page = agent.get('http://www.uhero.hawaii.edu/admin/login')
    
    login_page.form_with(:action => '/admin/login') do |f|
    	f.send('data[User][login]=', ENV['cms_user'])
    	f.send('data[User][pass]=', ENV['cms_pass'])
    end.click_button
    
    new_product_page = agent.get('http://www.uhero.hawaii.edu/admin/news/add')
    
    conf_page = new_product_page.form_with(:action => '/admin/news/add') do |f|
      
    	f.send('data[NewsPost][title]=', "#{a_series.description} (#{self.name})")
    	f.send('data[NewsPost][content]=', post_body)
    	#f.checkbox_with(:value => '2').check
      
    end.click_button

    product_posts = Array.new
    conf_page.links.each do |link|
    	product_posts.push link.href unless link.href['admin/news/edit'].nil?
    end
    product_posts.sort.reverse[0]
    
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def print_data_points_DELETEME
    data_hash = {}
    source_array = []
    
    data_sources.each { |ds| source_array.push ds.id }  
    source_array.each_index {|index| puts "(#{index}) #{DataSource.find_by(id: source_array[index]).eval}"}
    xseries.data_points.each do |dp|
      data_hash[dp.date] ||= []
      data_hash[dp.date].push("#{'H' unless dp.history.nil?}#{'|' unless dp.current} #{dp.value} (#{source_array.index(dp.data_source_id)})".rjust(10, ' '))
    end
  
    data_hash.sort.each do |date, value_array|
      puts "#{date}: #{value_array.sort.join}"
    end
    puts name
  end
  
  
  def month_mult
    return 1 if frequency == 'month'
    return 3 if frequency == 'quarter'
    return 6 if frequency == 'semi'
    12 if frequency == 'year'
  end
  
  def date_range
    data_dates = self.data.keys.sort
    start_date = data_dates[0]
    end_date = data_dates[-1]
    curr_date = start_date
    dates = []
    offset = 0
    
    if frequency == 'day' or frequency == 'week'
      day_multiplier = frequency == 'day' ? 1 : 7
      begin
        curr_date = start_date + offset * day_multiplier
        dates.push(curr_date)
        offset += 1
      end while curr_date < end_date
    else
      month_multiplier = month_mult
      begin
        curr_date = start_date>>offset*month_multiplier
        dates.push(curr_date)
        offset += 1
      end while curr_date < end_date
    end
    dates
  end

  def Series.run_tsd_exports(files = nil, out_path = nil, in_path = nil)
    ## This routine assumes DATA_PATH is the same on both prod and worker, but this is probly a safe bet
    out_path ||= File.join(ENV['DATA_PATH'], 'udaman_tsd')
     in_path ||= File.join(ENV['DATA_PATH'], 'BnkLists')

    Rails.logger.info { "run_tsd_exports: starting at #{Time.now}" }
    ## Hostname alias "macmini" is defined in /etc/hosts - change there if necessary
    if system("rsync -r --del uhero@macmini:/Volumes/UHERO/UHEROwork/MacMiniData/BnkLists/ #{in_path}")
      Rails.logger.info { "run_tsd_exports: synced #{in_path} from Mac mini to local disk" }
    else
      Rails.logger.error { "run_tsd_exports: Could not sync #{in_path} from Mac mini to local disk - using existing files" }
    end

    files ||= Dir.entries(in_path).select {|f| f =~ /\.txt$/ }
    files.each do |filename|
      Rails.logger.info { "run_tsd_exports: processing input file #{filename}" }
      f = open File.join(in_path, filename)
      list = f.read.split(/\s+/).reject {|x| x.blank? }
      f.close

      bank = filename.sub('.txt', '')
      frequency_code = bank.split('_')[-1].upcase
      list.map! {|name| "#{name.strip.upcase}.#{frequency_code}" }
      output_file = File.join(out_path, bank + '.tsd')
      Rails.logger.info { "run_tsd_exports: exporting series to #{output_file}" }
      Series.write_data_list_tsd(list, output_file)
    end

    mini_location = 'uhero@macmini:/Volumes/UHERO/UHEROwork/MacMiniData/udaman_tsd'
    if system("rsync -r #{out_path}/ #{mini_location}")  ## final slash needed on source dir name
      Rails.logger.info  { "run_tsd_exports: Contents of #{out_path} COPIED to Mac mini" }
    else
      Rails.logger.error { "run_tsd_exports: Could not copy contents of #{out_path} directory to Mac mini" }
    end
    prod_location = 'uhero@udaman.uhero.hawaii.edu:' + out_path
    if system("rsync -r #{out_path}/ #{prod_location}")  ## this copy might not be needed. If not, 86 it later.
      Rails.logger.info  { "run_tsd_exports: Contents of #{out_path} COPIED to production" }
    else
      Rails.logger.error { "run_tsd_exports: Could not copy contents of #{out_path} to production" }
    end
    Rails.logger.info { "run_tsd_exports: finished at #{Time.now}" }
  end

  def get_tsd_series_data(tsd_file)
    url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{name.split('.')[0].gsub('%', '%25')}/json")
    res = Net::HTTP.new(url.host, url.port).request_get(url.path)
    tsd_data = res.code == '500' ? nil : JSON.parse(res.body)
    
    return nil if tsd_data.nil?
    clean_tsd_data = {}
    tsd_data['data'].each {|date_string, value| clean_tsd_data[Date.strptime(date_string, '%Y-%m-%d')] = value}
    tsd_data['data'] = clean_tsd_data
    new_transformation(tsd_data['name']+'.'+tsd_data['frequency'],  tsd_data['data'], Series.frequency_from_code(tsd_data['frequency']))
  end
  
  def tsd_string
    data_string = ''
    lm = xseries.data_points.order(:updated_at).last.updated_at

    as = AremosSeries.get name
    as_description = as.nil? ? '' : as.description

    dps = data
    dates = dps.keys.sort
    
    #this could stand to be much more sophisticated and actually look at the dates. I think this will suffice, though - BT
    day_switches = '0                '
    day_switches = '0         0000000'     if frequency == 'week'
    day_switches[10 + dates[0].wday] = '1' if frequency == 'week'
    day_switches = '0         1111111'     if frequency == 'day'
    
    data_string+= "#{name.split('.')[0].to_s.ljust(16, ' ')}#{as_description.to_s.ljust(64, ' ')}\r\n"
    data_string+= "#{lm.month.to_s.rjust(34, ' ')}/#{lm.day.to_s.rjust(2, ' ')}/#{lm.year.to_s[2..4]}0800#{dates[0].tsd_start(frequency)}#{dates[-1].tsd_end(frequency)}#{Series.code_from_frequency frequency}  #{day_switches}\r\n"
    sci_data = {}
    
    dps.each do |date, _|
      sci_data[date] = ('%.6E' % units_at(date)).insert(-3, '00')
    end
    
    
    dates = date_range
    dates.each_index do |i|
    # sci_data.each_index do |i|
      date = dates[i]
      dp_string = sci_data[date].nil? ? '1.000000E+0015'.rjust(15, ' ') : sci_data[date].to_s.rjust(15, ' ')
      data_string += dp_string
      data_string += "     \r\n" if (i+1)%5==0
    end    
    space_padding = 80 - data_string.split("\r\n")[-1].length
    space_padding == 0 ? data_string : data_string + ' ' * space_padding + "\r\n"
  end
  
  def refresh_all_datapoints
    unique_ds = {} #this is actually used ds
    current_data_points.each {|dp| unique_ds[dp.data_source_id] = 1}
    eval_statements = []
    self.data_sources_by_last_run.each do |ds| 
      eval_statements.push(ds.get_eval_statement) unless unique_ds.keys.index(ds.id).nil?
      ds.delete
    end
    eval_statements.each {|es| eval(es)}
  end
  
  def delete_with_data
    puts "deleting #{name}"
    data_sources.each do |ds|
      puts "deleting: #{ds.id}" + ds.eval 
      ds.delete
    end
    self.delete
  end

  def Series.get_all_series_by_eval(patterns)
    if patterns.class == String
      patterns = [patterns]
    end
    names = []
    all_uhero = DataSource.get_all_uhero
    patterns.each do |pat|
      pat.gsub!('%','\%')
      names |= all_uhero.where("eval LIKE '%#{pat}%'").joins(:series).pluck(:name)
    end
    seen_series = []
    all_names = names.dup
    names.each do |name|
      Rails.logger.debug { name }
      dependents = Series.all_who_depend_on(name, seen_series)
      seen_series |= [name, dependents].flatten
      all_names |= dependents
    end
    Series.where(name: all_names)
  end

  #currently runs in 3 hrs (for all series..if concurrent series could go first, that might be nice)
  #could do everything with no dependencies first and do all of those in concurrent fashion...
  #to find errors, or broken series, maybe update the ds with number of data points loaded on last run?
  
  def Series.run_all_dependencies(series_list, already_run, errors, eval_statements, clear_first = false)
    series_list.each do |s_name|
      next unless already_run[s_name].nil?
      s = s_name.ts
      begin
        Series.run_all_dependencies(s.who_i_depend_on, already_run, errors, eval_statements) ## recursion
      rescue
        puts '-------------------THIS IS THE ONE THAT BROKE--------------------'
        puts s.id
        puts s.name
      end
      errors.concat s.reload_sources(false, clear_first)  ## hardcoding as NOT the series worker, because expecting to use
                                                          ## this code only for ad-hoc jobs from now on
      eval_statements.concat(s.data_sources_by_last_run.map {|ds| ds.get_eval_statement})
      already_run[s_name] = true
    end
  end

  def reload_sources(series_worker = false, clear_first = false)
    series_success = true
    self.data_sources_by_last_run.each do |ds|
      success = true
      begin
        success = ds.reload_source(clear_first) unless series_worker && !ds.reload_nightly
        unless success
          raise 'error in reload_source method, should be logged above'
        end
      rescue Exception => e
        series_success = false
        Rails.logger.error { "SOMETHING BROKE (#{e.message}) with source #{ds.id} in series <#{self.name}> (#{self.id})" }
      end
    end
    series_success
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def Series.missing_from_aremos_DELETE_ME
    name_buckets = {}
    (AremosSeries.all_names - Series.all_names).each {|name| name_buckets[name[0]] ||= []; name_buckets[name[0]].push(name)}
    name_buckets.each {|letter, names| puts "#{letter}: #{names.count}"}
    name_buckets
  end
  
  def Series.new_search(input_string)
    all = Series.joins(:xseries)
    univ = 'UHERO'
    conditions = []
    bindvars = []
    input_string.split.each do |term|
      term = term.gsub(/_/, '\_').gsub(/%/, '\%')  ## escape SQL wildcards (can't use gsub! method)
      tane = term[1..]
      case term
        when /^\//
          univ = { 'u' => 'UHERO', 'db' => 'DBEDT' }[tane] || tane
        when /^[=]/
          conditions.push %q{series.name = ?}
          bindvars.push tane
        when /^[~]/  ## tilde
          conditions.push %q{substring_index(name,'@',1) regexp ?}
          bindvars.push tane
        when /^\^/
          conditions.push %q{substring_index(name,'@',1) regexp ?}
          bindvars.push term  ## note term, not tane, because regexp accepts ^ syntax
        when /^[@]/
          all = all.joins(:geography)
          conditions.push %q{geographies.handle = ?}
          bindvars.push tane
        when /^[.]/
          freqs = tane.split(//)  ## split to individual characters
          qmarks = (['?'] * freqs.count).join(',')
          conditions.push %Q{xseries.frequency in (#{qmarks})}
          bindvars.push *freqs.map {|f| Series.frequency_from_code(f) }  ## need splat * to push elements rather than array
        when /^[#]/
          all = all.joins(:data_sources)
          conditions.push %q{data_sources.eval regexp ?}
          bindvars.push tane
        when /^[&]/
          conditions.push case tane
                            when 'pub' then %q{restricted = false}
                            when 'r'   then %q{restricted = true}
                            when 'sa'  then %q{seasonal_adjustment = 'seasonally_adjusted'}
                            when 'ns'  then %q{seasonal_adjustment = 'not_seasonally_adjusted'}
                            else nil
                          end
        when /^[-]/  ## minus
          conditions.push %q{concat(substring_index(name,'@',1),'|',coalesce(dataPortalName,''),'|',coalesce(description,'')) not regexp ?}
          bindvars.push tane
        else
          ## a "naked" word
          conditions.push %q{concat(substring_index(name,'@',1),'|',coalesce(dataPortalName,''),'|',coalesce(description,'')) regexp ?}
          bindvars.push term
      end
    end
    conditions.push %q{series.universe = ?}
    bindvars.push univ
    ##Rails.logger.debug { ">>>>>>>>> search conditions: #{conditions.join(' and ')}, bindvars: #{bindvars}" }
    all.where(conditions.join(' and '), *bindvars).limit(500).sort_by(&:name)
  end

  def Series.web_search(search_string, universe, num_results = 10)
    universe = 'UHERO' if universe.blank? ## cannot make this a param default because it is often == ''
    Rails.logger.debug { ">>>>>>>> Web searching for string |#{search_string}| in universe #{universe}" }
    regex = /"([^"]*)"/
    search_parts = (search_string.scan(regex).map {|s| s[0] }) + search_string.gsub(regex, '').split(' ')
    u = search_parts.select {|s| s =~ /^\// }.shift
    if u  ## universe explicitly supplied in search box
      search_parts.delete(u)
      u = u[1..]  ## chop off first / char
      universe = { 'u' => 'UHERO', 'db' => 'DBEDT' }[u] || u
    end
    name_where = search_parts.map {|s| "name LIKE '%#{s}%'" }.join(' AND ')
    desc_where = search_parts.map {|s| "description LIKE '%#{s}%'" }.join(' AND ')
    dpn_where = search_parts.map {|s| "dataPortalName LIKE '%#{s}%'" }.join(' AND ')
    where_clause = "((#{name_where}) OR (#{desc_where}) OR (#{dpn_where}))"

    series_results = Series.get_all_universe(universe).where(where_clause).limit(num_results)

    results = []
    series_results.each do |s|
      description = s.description ||
                    (AremosSeries.get(s.name).description rescue nil) ||
                    'no aremos series'
      results.push({ :name => s.name, :series_id => s.id, :description => description})
    end

    if universe == 'UHERO'
      aremos_desc_where = search_parts.map {|s| "description LIKE '%#{s}%'" }.join(' AND ')
      AremosSeries.where(aremos_desc_where).limit(num_results).each do |as|
        s = as.name.ts
        results.push({ name: as.name, series_id: (s.nil? ? 'no series' : s.id), description: as.description })
      end
    end
    results
  end

  def Series.assign_dependency_depth
    Rails.logger.info { "Assign_dependency_depth: start at #{Time.now}" }
    ActiveRecord::Base.connection.execute(<<~SQL)
      CREATE TEMPORARY TABLE IF NOT EXISTS t_series (PRIMARY KEY idx_pkey (id), INDEX idx_name (name))
          SELECT id, `name`, 0 AS dependency_depth FROM series WHERE universe = 'UHERO'
    SQL
    ActiveRecord::Base.connection.execute(<<~SQL)
      CREATE TEMPORARY TABLE IF NOT EXISTS t_datasources (INDEX idx_series_id (series_id))
          SELECT id, series_id, dependencies FROM data_sources WHERE universe = 'UHERO'
    SQL
    ActiveRecord::Base.connection.execute(<<~SQL)
      CREATE TEMPORARY TABLE t2_series LIKE t_series
    SQL
    ActiveRecord::Base.connection.execute(<<~SQL)
      INSERT INTO t2_series SELECT * FROM t_series
    SQL
    previous_depth_count = Series.count_by_sql('SELECT count(*) FROM t_series WHERE dependency_depth = 0')

    # first level of dependencies
    Rails.logger.debug { "Assign_dependency_depth: at #{Time.now}: previous_depth=0 previous_depth_count=#{previous_depth_count}" }
    first_level_sql = <<~SQL
      UPDATE t_series s SET dependency_depth = 1
      WHERE EXISTS (SELECT 1 FROM t_datasources WHERE `dependencies` LIKE CONCAT('% ', s.`name`, '%'));
    SQL
    ActiveRecord::Base.connection.execute(first_level_sql)
    current_depth_count = Series.count_by_sql('SELECT count(*) FROM t_series WHERE dependency_depth = 1')

    previous_depth = 1
    until current_depth_count == previous_depth_count
      Rails.logger.debug {
        "Assign_dependency_depth: at #{Time.now}: previous_depth=#{previous_depth} current_depth_count=#{current_depth_count}, previous_depth_count=#{previous_depth_count}"
      }
      ActiveRecord::Base.connection.execute(<<~SQL)
        /* Sync up t2_series table with t_series */
        UPDATE t2_series t2 JOIN t_series t ON t.id = t2.id SET t2.dependency_depth = t.dependency_depth
      SQL
      next_level_sql = <<~SQL
        UPDATE t_series s SET dependency_depth = #{previous_depth + 1}
        WHERE EXISTS (
          SELECT 1 FROM t_datasources ds JOIN t2_series ON ds.series_id = t2_series.id
          WHERE t2_series.dependency_depth = #{previous_depth}
          AND ds.`dependencies` LIKE CONCAT('% ', REPLACE(s.`name`, '%', '\\%'), '%')
        );
      SQL
      ActiveRecord::Base.connection.execute next_level_sql
      previous_depth_count = current_depth_count
      current_depth_count = Series.count_by_sql("SELECT count(*) FROM t_series WHERE dependency_depth = #{previous_depth + 1}")
      previous_depth += 1
    end

    Rails.logger.info { 'Assign_dependency_depth: Copy computed depths back to real series table' }
    ActiveRecord::Base.connection.execute(<<~SQL)
      UPDATE series JOIN t_series t ON t.id = series.id SET series.dependency_depth = t.dependency_depth
    SQL

    Rails.logger.info { "Assign_dependency_depth: done at #{Time.now}" }
  end

  # recursive incrementer of dependency_depth
  def increment_dependency_depth
    self.dependency_depth += 1
    dependencies = []
    self.data_sources.each do |ds|
      dependencies += ds.dependencies
    end
    dependencies.uniq.each do |dependency|
      Series.get(dependency).increment_dependency_depth
    end
  end

  def reload_with_dependencies
    Series.reload_with_dependencies([self.id])
  end

  def Series.reload_with_dependencies(series_id_list, clear_first = false)
    unless series_id_list.class == Array
      raise 'Series.reload_with_dependencies needs an array of series ids'
    end
    Rails.logger.info { 'reload_with_dependencies: start' }
    result_set = series_id_list
    next_set = series_id_list
    until next_set.empty?
      Rails.logger.debug { "reload_with_dependencies: next_set is #{next_set}" }
      qmarks = next_set.count.times.map{ '?' }.join(',')
      ## So wackt that find_by_sql works this way :( But if it's "fixed" in Rails 6, remove this comment :)
      ##   https://apidock.com/rails/ActiveRecord/Querying/find_by_sql (check sample code - method signature shown is wrong!)
      ##   https://stackoverflow.com/questions/18934542/rails-find-by-sql-and-parameter-for-id/49765762#49765762
      new_deps = Series.find_by_sql [<<~SQL, next_set].flatten
        select distinct data_sources.series_id as id
        from data_sources, series
        where series.id in (#{qmarks})
        and dependencies like CONCAT('% ', REPLACE(series.name, '%', '\\%'), '%')
      SQL
      next_set = new_deps.map(&:id) - result_set
      result_set += next_set
    end
    mgr = SeriesReloadManager.new(Series.where id: result_set)
    Rails.logger.info { "Series.reload_with_dependencies: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
    mgr.batch_reload(clear_first)
  end

  def Series.get_old_bea_downloads
    series = []
    Download.where(%q(handle like '%@bea.gov')).each do |dl|
      dl.data_sources.each do |ds|
        if ds.series.data_sources.select{|x| x.eval =~ /load_from_(bea|bls|fred)/ }.empty?
          series.push ds.series
        end
      end
    end
    series.sort{|x,y| x.name <=> y.name }
  end

  def Series.stale_since(past_day)
    horizon = Time.new(past_day.year, past_day.month, past_day.day, 20, 0, 0)  ## 8pm, roughly when nightly load starts
    Series.get_all_uhero
          .joins(:data_sources)
          .where('reload_nightly = true AND last_run_in_seconds < ?', horizon.to_i)
          .order('series.name, data_sources.id')
          .pluck('series.id, series.name, data_sources.id')
  end

  def Series.loaded_since(past_day)
    Series.get_all_uhero
        .joins(:data_sources)
        .where('reload_nightly = true')
        .order('series.name, data_sources.id')
        .pluck('series.id, series.name, data_sources.id') - Series.stale_since(past_day)
  end

  def source_link_is_valid
    source_link.blank? || valid_url(source_link) || errors.add(:source_link, 'is not a valid URL')
  end

  def force_destroy!
    self.update(scratch: 44444)  ## a flag to permit destruction even if there are inhibiting factors
    self.destroy!
  end

private
  def last_rites
#    throw(:abort) unless destroyable
#  end

#  def destroyable
    if is_primary? && !aliases.empty?
      Rails.logger.error { 'ERROR: Cannot delete primary series that has aliases. Delete aliases first.' }
#      errors.add(:base, 'Cannot destroy a series that has aliases. Delete aliases first.')
      raise SeriesDestroyException, 'Cannot destroy a series that has aliases. Delete aliases first.'
    end
    if !who_depends_on_me.empty? && !destroy_forced
      Rails.logger.error { 'ERROR: Cannot delete a series that has dependent series. Delete dependencies first.' }
#      errors.add(:base, 'Cannot destroy a series that has dependent series. Delete dependencies first.')
      raise SeriesDestroyException, 'Cannot destroy a series that has dependent series. Delete dependencies first.'
    end
    begin
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~MYSQL)
          delete from public_data_points where series_id = ?
      MYSQL
      stmt.execute(id)
      stmt.close
    rescue
      Rails.logger.error { 'ERROR: Unable to delete public data points before destruction of series' }
#      errors.add(:base, 'Unable to delete public data points before destruction of series.')
      raise SeriesDestroyException, 'ERROR: Unable to delete public data points before destruction of series'
    end
    if is_primary?
      xseries.update_attributes(primary_series_id: nil)  ## to avoid failure on foreign key constraint
      self.update_attributes(scratch: 90909)  ## a flag to tell next callback to delete the xseries
    end
    true
  end

  def post_mortem
    if scratch == 90909
      xseries.destroy!
    end
  end

  def destroy_forced
    scratch == 44444
  end

  def Series.display_options(options)
    options.select{|k,_| ![:data_source, :eval_hash, :dont_skip].include?(k) }
  end

end
