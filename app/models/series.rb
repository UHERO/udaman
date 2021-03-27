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
  include HelperUtilities
  extend Validators

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
  has_many :user_series, dependent: :delete_all
  has_many :users, -> {distinct}, through: :user_series

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

  def Series.get_or_new(name, universe = 'UHERO')
    Series.get(name, universe) || Series.new_transformation(name.upcase, {}, Series.parse_name(name)[:freq_long])
  end

  def Series.bulk_create(definitions)
    Series.transaction do
      definitions.each {|defn| Kernel::eval defn }
    end
    true
  end

  def rename(newname)
    newname.upcase!
    old_name = self.name
    return false if old_name == newname
    dependents = who_depends_on_me  ## must be done before we change the name
    parts = Series.parse_name(newname)
    geo_freq_change = geography.handle != parts[:geo] || frequency != parts[:freq_long]
    raise "Cannot rename because #{newname} already exists in #{universe}" if Series.get(newname, universe)
    geo = Geography.find_by(universe: universe, handle: parts[:geo]) || raise("No #{universe} Geography found, handle=#{parts[:geo]}")
    self.update!(name: newname, geography_id: geo.id, frequency: parts[:freq_long])
    if geo_freq_change
      data_sources.each {|ld| ld.delete_data_points }  ## clear all data points
    end
    dependents.each do |series_name|
      s = series_name.ts || next
      s.enabled_data_sources.each do |ds|
        new_eval = ds.eval.gsub(old_name, newname)
        ds.update_attributes!(eval: new_eval) if new_eval != ds.eval
      end
    end
    true
  end

  def create_alias(properties)
    raise "#{self} is not a primary series, cannot be aliased" unless is_primary?
    universe = properties[:universe].upcase rescue raise('Universe must be specified to create alias')
    raise "Cannot alias #{self} into same universe #{universe}" if universe == self.universe
    name = properties[:name] || self.name
    raise "Cannot alias because #{name} already exists in #{universe}" if Series.get(name, universe)
    new_geo = Geography.find_by(universe: universe, handle: geography.handle)
    raise "No geography #{geography.handle} exists in universe #{universe}" unless new_geo
    new = self.dup
    new.assign_attributes(properties.merge(geography_id: new_geo.id))
    new.save!
    new.xseries.update!(primary_series_id: self.id)  ## just for insurance
    new
  end

  def duplicate(newname, new_attrs = {})
    raise("Cannot duplicate because #{newname} already exists in #{universe}") if Series.get(newname, universe)
    raise("Cannot pass universe as a new attribute") if new_attrs[:universe]
    s_attrs = attributes.symbolize_keys   ## attr hash keys need to be symbols for create_new(). Also more Rubyesque.
    s_attrs[:name] = newname.upcase
    ## Get rid of properties that should not be duplicated. Some things will be handled transparently by create_new()
    s_attrs.delete(:xseries_id)
    s_attrs.delete(:geography_id)
    s_attrs.delete(:dependency_depth)
    x_attrs = xseries.attributes.symbolize_keys
    x_attrs.delete(:primary_series_id)
    x_attrs.delete(:frequency)
    Series.create_new(s_attrs.merge(x_attrs).merge(new_attrs))
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
      geo = Geography.find(properties[:geography_id]) rescue raise("No Geography with id=#{properties[:geography_id]} found")
    else
      uni = properties[:universe] || 'UHERO'
      geo = Geography.find_by(universe: uni, handle: name_parts[:geo]) || raise("No #{uni} Geography found, handle=#{name_parts[:geo]}")
    end
    properties[:name] ||= Series.build_name(name_parts[:prefix], geo.handle, name_parts[:freq])
    properties[:geography_id] ||= geo.id
    properties[:frequency] ||= Series.frequency_from_code(name_parts[:freq])

    series_attrs = Series.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }  ## no direct creation of Rails timestamps
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
      raise "Model object creation failed for name #{properties[:name]} in universe #{properties[:universe]}: #{e.message}"
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
    if string =~ /^((\S+?)(&([0-9Q]+|CURR)(v(\d+))?)?)@(\w+?)\.([ASQMWD])$/i
      return {
          prefix_full: $1,
          prefix: $2,
          forecast: ($4.upcase rescue $4),
          version: $6,
          geo: $7.upcase,
          freq: $8.upcase,
          freq_long: frequency_from_code($8).to_s
      }
    end
    raise SeriesNameException, "Invalid series name format: #{string}"
  end

  def parse_name
    Series.parse_name(self.name)
  end

  def Series.build_name(prefix, geo, freq)
    unless prefix && geo && freq
      raise 'Null members not allowed in series name! (got %s + %s + %s)' % [prefix, geo, freq]
    end
    name = prefix.strip.upcase + '@' + geo.strip.upcase + '.' + freq.strip.upcase
    Series.parse_name(name) && name
  end

  def Series.build_name_two(prefixgeo, freq)
    (prefix, geo) = prefixgeo.split('@')
    Series.build_name(prefix, geo, freq)
  end

  ## Build a new name starting from mine, and replacing whatever parts are passed in
  def build_name(new_parts)
    name = self.parse_name.merge(new_parts)
    Series.build_name(name[:prefix], name[:geo], name[:freq])
  end

  def ns_series_name
    self.build_name(prefix: self.parse_name[:prefix] + 'NS')
  end

  def non_ns_series_name
    self.build_name(prefix: self.parse_name[:prefix].sub(/NS$/i,''))
  end

  ## Find non-seasonally-adjusted correspondent series based on name
  def find_ns_series
    self.ns_series_name.ts
  end

  ## Find seasonally-adjusted correspondent series based on name
  def find_non_ns_series
    self.non_ns_series_name.ts
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
    self.enabled_data_sources.each do |ds|
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

  def Series.region_counts
    region_hash.map {|key, value| [key, value.count] }.to_h
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
    frequency_hash.map {|key, value| [key, value.count] }.to_h
  end

  def Series.code_from_frequency(frequency)
    frequency = frequency.to_s.downcase.sub(/ly$/,'')  ## handle words like annually, monthly, daily, etc
    frequency = 'semi' if frequency =~ /^semi/  ## just in case
    mapping = { year: 'A', annual: 'A', semi: 'S', quarter: 'Q', month: 'M', week: 'W', day: 'D', dai: 'D' }
    mapping[frequency.to_sym].to_s
  end

  def Series.frequency_from_code(code)
    case code && code.to_s.upcase
      when 'A' then :year
      when 'S' then :semi
      when 'Q' then :quarter
      when 'M' then :month
      when 'W' then :week
      when 'D' then :day
      else nil
    end
  end

  def Series.frequency_from_name(name)
    Series.parse_name(name)[:freq_long]
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

  def Series.eval(series_name, eval_statement, priority = 100)
    begin
      new_series = Kernel::eval eval_statement
    rescue => e
      raise "Series.eval for #{series_name} failed: #{e.message}"
    end
    Series.store(series_name, new_series, new_series.name, eval_statement, priority)
  end

  def Series.store(series_name, series, desc = nil, eval_statement = nil, priority = 100)
    desc = series.name if desc.nil?
    desc = 'Source Series Name is blank' if desc.blank?
    unless series.frequency == Series.frequency_from_name(series_name)
      raise "Frequency mismatch: attempt to assign name #{series_name} to data with frequency #{series.frequency}"
    end
    series_to_set = series_name.tsn
    series_to_set.frequency = series.frequency
    series_to_set.save_source(desc, eval_statement, series.data, priority)
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
    update_data(data, source)
    source
  end

  def enabled_data_sources
    data_sources.reject {|d| d.disabled? }
  end

  def data_sources_sort_for_display
    ## Disabled at the top, then non-nightlies, then by priority, then by id within priority groups.
    data_sources.sort_by {|ds| [(ds.disabled? ? 0 : 1), (ds.reload_nightly? ? 1 : 0), ds.priority, ds.id] }
    ## For some reason, sort_by does not take the boolean attributes as-is, but they need to be "reconverted"
    ## to integer - I am mystified by this.
  end

  def update_data(data, source)
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
    aremos_comparison #if we can take out this save, might speed things up a little
    true
  end

  def add_to_quarantine(run_update: true)
    self.update! quarantined: true
    DataPoint.update_public_data_points(universe, self) if run_update
  end

  def remove_from_quarantine(run_update: true)
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
    return {} unless xseries
    current_data_points.map {|dp| [dp.date, dp[column]] }.to_h
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def scaled_data_no_pseudo_history_DELETEME(round_to = 3)
    data_hash = {}
    self.units ||= 1
    self.units = 1000 if name[0..2] == 'TGB' #hack for the tax scaling. Should not save units
    xseries.data_points.each do |dp|
      data_hash[dp.date] = (dp.value / self.units).round(round_to) if dp.current and !dp.pseudo_history?
    end
    data_hash
  end
  
  def scaled_data(prec = 3)
    data_hash = {}
    self.units ||= 1
    self.units = 1000 if name[0..2] == 'TGB' #hack for the tax scaling. Should not save units
    sql = <<~SQL
      SELECT round(value/#{self.units}, #{prec}) AS value, date
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
    raise "Dataset for the series '#{name}' is empty/nonexistent" if data.nil?
    frequency = Series.frequency_from_code(frequency) || frequency || self.frequency || Series.frequency_from_name(name)
    Series.new(name: name,
               xseries: Xseries.new(frequency: frequency),
               data: Hash[data.reject {|_, v| v.nil? }.map {|date, value| [date.to_date, value] }]
    ).tap do |o|
      o.propagate_state_from(self)
    end
  end

  def propagate_state_from(series_obj)
    self.trim_period_start = series_obj.trim_period_start
    self.trim_period_end = series_obj.trim_period_end
  end

  def load_from(spreadsheet_path, sheet_to_load = nil)
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)
    raise 'Load error: File possibly missing?' if update_spreadsheet.load_error?
    raise 'Load error: File not formatted in expected way' unless update_spreadsheet.update_formatted?

    unless update_spreadsheet.class == UpdateCSV
      update_spreadsheet.default_sheet = sheet_to_load || update_spreadsheet.sheets.first
    end
    self.frequency = update_spreadsheet.frequency
    new_transformation("loaded from static file <#{spreadsheet_path}>", update_spreadsheet.series(self.name))
  end

  def load_sa_from(spreadsheet_path, sheet: 'sadata')
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)
    raise 'Load error: File possibly missing?' if update_spreadsheet.load_error?
    return self unless update_spreadsheet.update_formatted?  ## is there some reason we don't raise exception for this one?

    unless update_spreadsheet.class == UpdateCSV
      update_spreadsheet.default_sheet = sheet
    end
    self.frequency = update_spreadsheet.frequency
    new_transformation("loaded sa from static file <#{spreadsheet_path}>", update_spreadsheet.series(self.ns_series_name))
  end
  
  def load_mean_corrected_sa_from(spreadsheet_path, sheet: 'sadata')
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)
    raise 'Load error: File possibly missing?' if update_spreadsheet.load_error?
    return self unless update_spreadsheet.update_formatted?  ## is there some reason we don't raise exception for this one?

    unless update_spreadsheet.class == UpdateCSV
      # default_sheet = update_spreadsheet.sheets.first
      update_spreadsheet.default_sheet = sheet
    end
    ns_series = find_ns_series || raise("No NS series corresponds to #{self}")
    demetra_series = new_transformation('demetra series', update_spreadsheet.series(ns_series.name))
    demetra_series.frequency = update_spreadsheet.frequency.to_s
    self.frequency = update_spreadsheet.frequency
    mean_corrected = demetra_series / demetra_series.annual_sum * ns_series.annual_sum
    new_transformation("mean corrected against #{ns_series} and loaded from <#{spreadsheet_path}>", mean_corrected.data)
  end

  ## This is for code testing purposes - generate random series data within the ranges specified
  def Series.generate_random(freq, start_date = nil, end_date = nil, low_range = 0.0, high_range = 100.0, specific_points = {})
    start_date ||= (Date.today - 5.years).send("#{freq}_d")   ## find the *_d methods in date_extension.rb
    end_date ||= Date.today.send("#{freq}_d")
    incr = 1
    if freq == 'quarter'
      freq = 'month'
      incr = 3
    end
    series_data = {}
    iter = start_date.to_date
    upto = end_date.to_date
    while iter <= upto do
      series_data[iter] = low_range + rand(high_range - low_range)
      iter += incr.send(freq)
    end
    specific_points.each do |date, value|
      series_data[date.to_date] = value
    end
    Series.new_transformation("randomly generated test data", series_data, freq)
  end

  def Series.load_from_download(handle, options)
    dp = DownloadProcessor.new(handle, options)
    series_data = dp.get_data
    descript = "loaded from #{handle} into a series of files"
    if Series.valid_download_handle(handle, date_sensitive: false)
      path = Download.get(handle, :nondate).save_path_relativized rescue raise("Unknown download handle #{handle}")
      descript = "loaded from download to <#{path}>"
    end
    Series.new_transformation(descript, series_data, frequency_from_code(options[:frequency]))
  end

  def Series.load_from_file(file, options)
    %x(chmod 766 #{file}) unless file.include? '%'
    dp = DownloadProcessor.new('manual', options.merge(:path => file))
    series_data = dp.get_data
    Series.new_transformation("loaded from static file <#{file}>", series_data, frequency_from_code(options[:frequency]))
  end
  
  def Series.load_api_bea(frequency, dataset, parameters)
    dhp = DataHtmlParser.new
    series_data = dhp.get_bea_series(dataset, parameters)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, frequency)
  end
  
  def Series.load_api_bls(code, frequency)
    Series.new.load_api_bls(code, frequency) ##### look into this method: what happens if frequency.nil? and self.data.empty? (CAN it be?)
  end
  
  def load_api_bls(code, frequency = nil)
    series_data = DataHtmlParser.new.get_bls_series(code, frequency)
    name = "loaded series code: #{code} from BLS API"
    if series_data && series_data.empty?
      name = "No data collected from BLS API for #{code} freq=#{frequency} - possibly redacted"
    end
    new_transformation(name, series_data, frequency)
  end

  def Series.load_api_fred(code, frequency = nil, aggregation_method = nil)
    dhp = DataHtmlParser.new
    series_data = dhp.get_fred_series(code, frequency, aggregation_method)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, frequency)
  end

  def Series.load_api_estatjp(code, filters)
    ### Note: Code is written to collect _only_ monthly data!
    dhp = DataHtmlParser.new
    series_data = dhp.get_estatjp_series(code, filters)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, 'M')
  end

  def Series.load_api_clustermapping(dataset, parameters)
    dhp = DataHtmlParser.new
    series_data = dhp.get_clustermapping_series(dataset, parameters)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, 'A')
  end

  def Series.load_api_eia(parameter)
    parameter.upcase!  # Series ID in the EIA API is case sensitive
    dhp = DataHtmlParser.new
    series_data = dhp.get_eia_series(parameter)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, parameter[-1])
  end

  def Series.load_api_dvw(mod, freq, indicator, dimensions)
    dhp = DataHtmlParser.new
    series_data = dhp.get_dvw_series(mod, freq, indicator, dimensions)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, freq)
  end

  def days_in_period
    new_data = {}
    data.each do |date, _|
      new_data[date] = date.days_in_period(frequency)
    end
    new_transformation("number of days in each #{frequency}", new_data, frequency)
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
    self.enabled_data_sources.each do |ds|
      return true unless ds.eval.index(string).nil?
    end
    false
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def handle_DELETEME?
    self.enabled_data_sources.each do |ds|
      unless ds.eval.index('load_from_download').nil?
        return ds.eval.split('load_from_download')[1].split("\"")[1]
      end
    end
    nil
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def original_url_DELETEME?
    self.enabled_data_sources.each do |ds|
      unless ds.eval.index('load_from_download').nil?
        return Download.get(ds.eval.split('load_from_download')[1].split("\"")[1]).url
      end
    end
    nil
  end
  
  def at(date)
    unless date.class == Date
      date = Date.parse(date) rescue raise("Series.at: parameter #{date} not a proper date string")
    end
    data[date]
  end
  
  def units_at(date)
    dd = data[date]
    return nil if dd.nil?
    self.units ||= 1
    dd / self.units
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def new_at_DELETEME(date)
    DataPoint.first(:conditions => {:date => date, :current => true, :series_id => self.id})
  end

  def observation_count
    observations = 0
    data.each do |_, value|
      observations += 1 unless value.nil?
    end
    observations
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
    ## Hostname alias "uheronas" is defined in /etc/hosts - change there if necessary
    nas_path = 'udaman@uheronas:/volume1/UHEROroot/work/udamandata'

    Rails.logger.info { "run_tsd_exports: starting at #{Time.now}" }
    if system("rsync -r --del #{nas_path}/BnkLists/ #{in_path}")  ## final slash needed on source dir name
      Rails.logger.info { "run_tsd_exports: synced #{in_path} from NAS to local disk" }
    else
      Rails.logger.error { "run_tsd_exports: Could not sync #{in_path} from NAS to local disk - using existing files" }
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
      Rails.logger.info { "run_tsd_exports: export #{list} to #{output_file}" }
      Series.write_data_list_tsd(list, output_file)
    end

    if system("rsync -r #{out_path}/ #{nas_path}/udaman_tsd")  ## final slash needed on source dir name
      Rails.logger.info  { "run_tsd_exports: Contents of #{out_path} COPIED to NAS" }
    else
      Rails.logger.error { "run_tsd_exports: Could not copy contents of #{out_path} directory to NAS" }
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

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def delete_with_data_DELETEME?
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

  ### This method doesn't really seem to be used for anything any more, so it can probably be 86ed at some point.
  ### Or not.... maybe just leave it because it might be useful again, who knows.
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

  def reload_sources(nightly_worker = false, clear_first = false)
    series_success = true
    self.data_sources_by_last_run.each do |ds|
      success = true
      begin
        success = ds.reload_source(clear_first) unless nightly_worker && !ds.reload_nightly
        unless success
          raise 'error in reload_source method, should be logged above'
        end
      rescue => e
        series_success = false
        Rails.logger.error { "SOMETHING BROKE (#{e.message}) with source #{ds.id} in series <#{self.name}> (#{self.id})" }
      end
    end
    series_success
  end

  ## this appears to be vestigial. Renaming now; if nothing breaks, delete later
  def Series.missing_from_aremos_DELETEME?
    name_buckets = {}
    (AremosSeries.all_names - Series.all_names).each {|name| name_buckets[name[0]] ||= []; name_buckets[name[0]].push(name)}
    name_buckets.each {|letter, names| puts "#{letter}: #{names.count}"}
    name_buckets
  end
  
  def Series.search_box(input_string, limit: 10000, user_id: nil)
    all = Series.joins(:xseries)
    univ = 'UHERO'
    conditions = []
    bindvars = []
    input_string.split.each do |term|
      negated = nil
      if term[0] == '-'
        negated = 'not '
        term = term[1..]  ## chop off initial '-'
      end
      tane = term[1..]  ## chop off operator, if any
      case term
        when /^\//
          univ = { u: 'UHERO', db: 'DBEDT' }[tane.to_sym] || tane
        when /^[+]/
          limit = tane.to_i
        when /^[=]/
          conditions.push %q{series.name = ?}
          bindvars.push tane
        when /^\^/
          conditions.push %Q{substring_index(name,'@',1) #{negated}regexp ?}
          bindvars.push term  ## note term, not tane, because regexp accepts ^ syntax
        when /^[~]/  ## tilde
          conditions.push %Q{substring_index(name,'@',1) #{negated}regexp ?}
          bindvars.push tane
        when /^[:]/
          if term =~ /^::/
            all = all.joins('left outer join sources on sources.id = series.source_id')
            conditions.push %Q{concat(coalesce(source_link,''),'|',coalesce(sources.link,'')) #{negated}regexp ?}
            bindvars.push tane[1..]
          else
            conditions.push %Q{source_link #{negated}regexp ?}
            bindvars.push tane
          end
        when /^[@]/
          all = all.joins(:geography)
          geos = tane.split(',').map {|g| g.upcase == 'HI5' ? %w{HI HAW HON KAU MAU} : g }.flatten
          qmarks = (['?'] * geos.count).join(',')
          conditions.push %Q{geographies.handle #{negated}in (#{qmarks})}
          bindvars.concat geos
        when /^[.]/
          freqs = tane.split(//)  ## split to individual characters
          qmarks = (['?'] * freqs.count).join(',')
          conditions.push %Q{xseries.frequency #{negated}in (#{qmarks})}
          bindvars.concat freqs.map {|f| frequency_from_code(f) }
        when /^[#]/
          all = all.joins('inner join data_sources as l1 on l1.series_id = series.id and not(l1.disabled)')
          conditions.push %q{l1.eval regexp ?}
          bindvars.push tane
        when /^[!]/
          all = all.joins('inner join data_sources as l2 on l2.series_id = series.id and not(l2.disabled)')
          conditions.push %q{l2.last_error regexp ?}
          bindvars.push tane
        when /^[&]/
          conditions.push case tane.downcase
                          when 'pub' then %q{restricted = false}
                          when 'r'   then %q{restricted = true}
                          when 'sa'  then %q{seasonal_adjustment = 'seasonally_adjusted'}
                          when 'ns'  then %q{seasonal_adjustment = 'not_seasonally_adjusted'}
                          when 'noclip'
                            raise 'No user identified for clipboard access' if user_id.nil?
                            bindvars.push user_id.to_i
                            %q{series.id not in (select series_id from user_series where user_id = ?)}
                          else nil
                          end
        when /^\s*\d+\b/
          ### Series ID# or comma-separated list of same. Note that the loop becomes irrelevant. There should be nothing
          ### else in the box except a list of numbers, so we just break the loop after setting the conditions, etc.
          sids = input_string.gsub(/\s+/, '').split(',').map(&:to_i)
          qmarks = (['?'] * sids.count).join(',')
          conditions.push %Q{series.id in (#{qmarks})}
          bindvars = sids
          univ = nil  ## disable setting of the universe - not wanted for direct ID number access
          break
        else
          ## a "bare" text string
          conditions.push %Q{concat(substring_index(name,'@',1),'|',coalesce(dataPortalName,''),'|',coalesce(series.description,'')) #{negated}regexp ?}
          bindvars.push term
      end
    end
    if univ
      conditions.push %q{series.universe = ?}
      bindvars.push univ
    end
    all.distinct.where(conditions.join(' and '), *bindvars).limit(limit).sort_by(&:name)
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

  ## probably vestigial - make sure, then delete later
  def increment_dependency_depth_DELETEME
    self.dependency_depth += 1
    dependencies = []
    self.enabled_data_sources.each do |ds|
      dependencies += ds.dependencies
    end
    dependencies.uniq.each do |dependency|
      Series.get(dependency).increment_dependency_depth
    end
  end

  def reload_with_dependencies
    Series.reload_with_dependencies([self.id], 'self')
  end

  def Series.reload_with_dependencies(series_id_list, suffix = 'adhoc', nightly: false, clear_first: false)
    unless series_id_list.class == Array
      raise 'Series.reload_with_dependencies needs an array of series ids'
    end
    Rails.logger.info { 'reload_with_dependencies: start' }
    result_set = series_id_list
    next_set = series_id_list
    until next_set.empty?
      Rails.logger.debug { "reload_with_dependencies: next_set is #{next_set}" }
      qmarks = (['?'] * next_set.count).join(',')
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
    mgr = SeriesReloadManager.new(Series.where(id: result_set), suffix, nightly: nightly)
    Rails.logger.info { "Series.reload_with_dependencies: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
    mgr.batch_reload(clear_first: clear_first)
  end

  def Series.get_old_bea_downloads
    series = []
    Download.where(%q(handle like '%@bea.gov')).each do |dl|
      dl.enabled_data_sources.each do |ds|
        series.push ds.series
      end
    end
    series.sort_by(&:name)
  end

  def source_link_is_valid
    source_link.blank? || Series.valid_url(source_link) || errors.add(:source_link, 'is not a valid URL')
  end

  def force_destroy!
    self.update_attributes(scratch: 44444)  ## a flag to permit destruction even with certain inhibiting factors
    self.destroy!
  end

  def debug_reload?
    scratch == 50505  ## a flag to permit change of loglevel when debugging on sidekiq, etc.
  end

private

  def last_rites
    Rails.logger.info { "DESTROY series #{self}: start" }
    if is_primary? && !aliases.empty?
      message = "ERROR: Cannot destroy primary series #{self} with aliases. Delete aliases first."
      Rails.logger.error { message }
      raise SeriesDestroyException, message
      ## Although Rails 5 documentation states that callbacks such as this one should be aborted using throw(:abort),
      ## I found that it is not possible for throw to be accompanied by an informative error message for the user, and
      ## as a result I've decided to use raise instead. It seems to work just as well.
    end
    if !who_depends_on_me.empty? && !destroy_forced
      message = "ERROR: Cannot destroy series #{self} with dependent series. Delete dependencies first."
      Rails.logger.error { message }
      raise SeriesDestroyException, message
    end
    begin
      stmt = ActiveRecord::Base.connection.raw_connection.prepare(<<~MYSQL)
          delete from public_data_points where series_id = ?
      MYSQL
      stmt.execute(id)
      stmt.close
    rescue
      message = "ERROR: Unable to delete public data points before destruction of series #{self}"
      Rails.logger.error { message }
      raise SeriesDestroyException, message
    end
    if is_primary?
      xseries.update_attributes(primary_series_id: nil)  ## to avoid failure on foreign key constraint
      self.update_attributes(scratch: 90909)  ## a flag to tell next callback to delete the xseries
    end
  end

  def post_mortem
    if scratch == 90909
      xseries.destroy!
    end
    Rails.logger.info { "DESTROY series #{self}: done" }
  end

  def destroy_forced
    scratch == 44444
  end

  def Series.display_options(options)
    options.select{|k,_| ![:data_source, :eval_hash, :dont_skip].include?(k) }
  end

end
