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
  validate :required_fields
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
      self.update(frequency: frequency_from_name)
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

  def observation_count
    data.reject {|_,val| val.nil? }.count
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
    Series.get(name, universe) || Series.new_transformation(name.upcase, {}, Series.frequency_from_name(name) || 'X')
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
      delete_data_points  ## clear all data points
    end
    dependents.each do |series_name|
      s = series_name.tsnil || next
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
    new.xseries.update_columns(primary_series_id: self.id)  ## just for extra insurance
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

  def Series.create_new(attributes)
    ## :xseries_attributes and :name_parts only present when called from SeriesController#create
    xs_attrs = attributes.delete(:xseries_attributes)
    if xs_attrs
      attributes.merge!(xs_attrs)
    end
    name_parts = attributes.delete(:name_parts)
    if name_parts
      attributes.merge!(name_parts)
    else
      name_parts = Series.parse_name(attributes[:name])
    end

    if attributes[:geography_id]
      geo = Geography.find(attributes[:geography_id]) rescue raise("No Geography with id=#{attributes[:geography_id]} found")
    else
      uni = attributes[:universe] || 'UHERO'
      geo = Geography.find_by(universe: uni, handle: name_parts[:geo]) || raise("No #{uni} Geography found, handle=#{name_parts[:geo]}")
    end
    attributes[:name] ||= Series.build_name(name_parts[:prefix], geo.handle, name_parts[:freq])
    attributes[:geography_id] ||= geo.id
    attributes[:frequency] ||= name_parts[:freq_long]
    Series.meta_integrity_check(attributes)

    series_attrs = Series.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }  ## no direct creation of Rails timestamps
    series_props = attributes.select{|k, _| series_attrs.include? k.to_s }
    xseries_attrs = Xseries.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }
    xseries_props = attributes.select{|k, _| xseries_attrs.include? k.to_s }
    s = nil
    begin
      self.transaction do
        x = Xseries.create!(xseries_props.merge(primary_series: Series.new(series_props)))  ## Series is also saved & linked to Xseries via xseries_id
        s = x.primary_series
        x.update_columns(primary_series_id: s.id)  ## But why is this necessary? Shouldn't Rails have done this already? But it doesn't.
        s.update_columns(scratch: 0)  ## in case no_enforce_fields had been used in Series.store(), clear this out
      end
    rescue => e
      raise "Model object creation failed for name #{attributes[:name]} in universe #{attributes[:universe]}: #{e.message}"
    end
    s
  end

  ## NOTE: Overriding an important ActiveRecord core method!
  def update(attributes)
    xs_attrs = attributes.delete(:xseries_attributes)
    if xs_attrs
      attributes.merge!(xs_attrs)
    end
    Series.meta_integrity_check(attributes, self)

    series_attrs = Series.attribute_names.reject{|a| a == 'id' || a == 'universe' || a =~ /ted_at$/ } ## no direct update of Rails timestamps
    xseries_attrs = Xseries.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }
    begin
      with_transaction_returning_status do  ## block must return true for transaction to commit
        assign_attributes(attributes.select{|k,_| series_attrs.include? k.to_s })
        save_status = save
        save_status && is_primary? ? xseries.update(attributes.select{|k,_| xseries_attrs.include? k.to_s }) : save_status
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
    Series.meta_integrity_check(attributes, self)

    series_attrs = Series.attribute_names.reject{|a| a == 'id' || a == 'universe' || a =~ /ted_at$/ } ## no direct update of Rails timestamps
    xseries_attrs = Xseries.attribute_names.reject{|a| a == 'id' || a =~ /ted_at$/ }
    begin
      with_transaction_returning_status do  ## block must return true for transaction to commit
        assign_attributes(attributes.select{|k,_| series_attrs.include? k.to_s })
        save_status = save!
        save_status && is_primary? ? xseries.update!(attributes.select{|k,_| xseries_attrs.include? k.to_s }) : save_status
      end
    rescue => e
      raise "Model object update! failed for Series #{name} (id=#{id}): #{e.message}"
    end
  end

  alias update_attributes! update!

  ## Enforce metadata integrity in the form of implicational relationships between/among attributes
  def Series.meta_integrity_check(attrs, obj = nil)
    if attrs[:frequency] && attrs[:frequency].to_sym == :year
      attrs[:seasonal_adjustment] = 'not_applicable'
    elsif attrs[:name] && Series.parse_name(attrs[:name])[:prefix] =~ /NS$/i
      attrs[:seasonal_adjustment] = 'not_seasonally_adjusted'
    end
    unit = attrs[:unit_id] && Unit.find(attrs[:unit_id].to_i) rescue nil
    if unit
      attrs[:percent] = (unit.short_label == '%')
    elsif obj
      attrs[:percent] = (obj.unit.short_label == '%') rescue false
    end
  end

  def Series.parse_name(string)
    if string =~ /^(([%$\w]+?)(&([0-9Q]+)([FH])(\d+|F))?)@(\w+?)(\.([ASQMWD]))?$/i
      freq_long = frequency_from_code($9)
      return {
        prefix_full: $1,
        prefix: $2,
        forecast: ($4.upcase rescue $4),
        version: ($6.upcase if $5.upcase == 'F' rescue $6),
        history: ($6.upcase if $5.upcase == 'H' rescue $6),
        geo: $7.upcase,
        freq: ($9.upcase rescue $9),
        freq_long: freq_long && freq_long.to_s
      }
    end
    raise SeriesNameException, "Invalid series name format: #{string}"
  end

  def parse_name
    Series.parse_name(self.name)
  end

  def Series.build_name(prefix, geo, freq = nil)
    if prefix.blank? || geo.blank?
      raise 'Empty prefix (got "%s") and/or geography (got "%s") not allowed in series name!' % [prefix, geo]
    end
    name = prefix.strip.upcase + '@' + geo.strip.upcase
    name +=  '.' + freq.strip.upcase unless freq.blank?
    Series.parse_name(name) && name
  end

  def Series.build_name_from_hash(h)
    Series.build_name(h[:prefix], h[:geo], h[:freq])
  end

  def Series.build_name_two(prefixgeo, freq)
    (prefix, geo) = prefixgeo.split('@')
    Series.build_name(prefix, geo, freq)
  end

  def name_no_freq
    build_name(freq: nil)
  end

  ## Build a new name starting from mine, and replacing whatever parts are passed in
  def build_name(new_parts)
    Series.build_name_from_hash( self.parse_name.merge(new_parts) )
  end

  def ns_series_name
    prefix = self.parse_name[:prefix]
    raise "Trying to add NS to prefix of #{self} that already has NS" if prefix =~ /NS$/i
    build_name(prefix:  prefix + 'NS')
  end

  def non_ns_series_name
    build_name(prefix: self.parse_name[:prefix].sub(/NS$/i,''))
  end

  ## Find non-seasonally-adjusted correspondent series based on name
  def find_ns_series
    ns_series_name.tsnil
  end

  ## Find seasonally-adjusted correspondent series based on name
  def find_non_ns_series
    non_ns_series_name.tsnil
  end

  ## Find "sibling" series for a different geography
  def find_sibling_for_geo(geo)
    build_name(geo: geo.to_s.upcase).tsnil
  end

  ## Find "sibling" series for a different frequency
  def find_sibling_for_freq(freq)
    build_name(freq: freq.to_s.upcase).tsnil
  end

  def is_primary?
    xseries.primary_series === self
  end

  def is_alias?
    !is_primary?
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

  def frequency_code
    Series.code_from_frequency(self.frequency)
  end

  def Series.eval(series_name, eval_statement, priority = 100, no_enforce_fields: false)
    begin
      new_series = Kernel::eval eval_statement
    rescue => e
      raise "Series.eval for #{series_name} failed: #{e.message}"
    end
    Series.store(series_name, new_series, new_series.name, eval_statement, priority, no_enforce_fields: no_enforce_fields)
  end

  def Series.store(series_name, series, desc = nil, eval_statement = nil, priority = 100, no_enforce_fields: false)
    desc = series.name if desc.nil?
    desc = 'Source Series Name is blank' if desc.blank?
    unless series.frequency == Series.frequency_from_name(series_name)
      raise "Frequency mismatch: attempt to assign name #{series_name} to data with frequency #{series.frequency}"
    end
    properties = { universe: 'UHERO', name: series_name.upcase, frequency: series.frequency }
    properties[:scratch] = 11011 if no_enforce_fields  ## set flag saying "don't validate fields"
    new_series = series_name.tsnil || Series.create_new(properties)
    new_series.update_columns(scratch: 0) if no_enforce_fields  ## clear the flag
    new_series.save_source(desc, eval_statement, series.data, priority)
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

  def enabled_data_sources(match = '.')
    data_sources.to_a.select {|ld| ld.disabled? == false && ld.eval =~ %r/#{match}/i }
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
    data.each_pair {|date, value| formatted_data[date.to_date] = value}
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
        :pseudo_history => source.pseudo_history,
        :data_source_id => source.id
      )
    end
    ### I've decided to comment out following line bec I think we don't do this/care about this any more
    ##aremos_comparison #if we can take out this save, might speed things up a little
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

  def Series.do_forecast_upload(params)
    fcid = params[:fcid].strip.upcase
    raise 'Bad forecast identifier' unless fcid =~ /^\d\dQ\d+$/
    vers = params[:version].strip.upcase
    raise 'Bad version' unless vers =~ /^[FH](\d+|F)$/
    freq = params[:freq]
    relpath = File.join('forecasts', params[:filepath])
    filepath = File.join(ENV['DATA_PATH'], relpath)
    if relpath =~ /csv$/i
      csv = UpdateCSV.new(filepath)
      raise 'Unexpected csv format - series not in columns?' unless csv.columns_have_series?
      names = csv.headers.keys
    else
      content = open(filepath, 'rb').read rescue raise("Cannot read file #{filepath}")
      tsd = TsdFile.new.assign_content(content)
      names = tsd.get_names
    end
    raise "No series names found in file #{filepath}" if names.empty?
    series = []
    names.each do |name|
      parts = Series.parse_name(name)
      if parts[:freq] && parts[:freq] != freq
        raise "Contained series #{name} does not match selected frequency #{freq}"
      end
      parts[:freq] = freq
      parts[:prefix] += '&' + fcid + vers
      series.push({ universe: 'FC', name: Series.build_name_from_hash(parts), ld_name: name })
    end
    ids = []
    self.transaction do
      series.each do |properties|
        ld_name = properties.delete(:ld_name)  ## remove this from properties or it'll screw up the find_by
        s = Series.find_by(properties) || Series.create_new(properties)

        if s.find_loaders_matching(relpath).empty?
          ld = DataSource.create(universe: 'FC',
                                 eval: %q{"%s".tsn.load_from("%s")} % [ld_name, relpath],
                                 clear_before_load: true,
                                 reload_nightly: false)
          s.data_sources << ld
          ld.set_color!
          ld.colleagues.each {|c| c.update!(priority: c.priority - 10) }  ## demote all existing loaders
        end
        s.link_to_forecast_measurements || Rails.logger.warn { "No matching measurement found for series #{s}" }
        s.reload_sources
        ids.push s.id
      end
    end
    ids
  end

  def find_loaders_matching(pattern, case_insens: false)
    regex = case_insens ? %r/#{pattern}/i : %r/#{pattern}/
    enabled_data_sources.select {|ld| ld.eval =~ regex }
  end

  def link_to_forecast_measurements
    m_found = false
    m_prefix = self.parse_name[:prefix].sub(/NS$/i, '')
    Measurement.where(universe: 'FC', prefix: m_prefix).each do |m|
      m_found = true
      (m.series << self) rescue nil
    end
    m_found
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

  def delete_data_points(from: nil)
    query = <<~MYSQL
      delete from data_points where xseries_id = ?
    MYSQL
    bindvars = [xseries_id]
    if from
      query += <<~MYSQL
        and date >= ?
      MYSQL
      bindvars.push from
    end
    stmt = Series.connection.raw_connection.prepare(query)
    stmt.execute(*bindvars)
    stmt.close
    Rails.logger.info { "Deleted all data points for series <#{self}> (#{id})" }
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
    return load_tsd_from(spreadsheet_path) if spreadsheet_path =~ /\.tsd$/i

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
    new_transformation("loaded SA from static file <#{spreadsheet_path}>", update_spreadsheet.series(self.ns_series_name))
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

  def load_tsd_from(path)
    content = open(File.join(ENV['DATA_PATH'], path.strip), 'rb').read rescue raise("Cannot read file #{path}")
    tsd = TsdFile.new.assign_content(content)
    series_hash = tsd.get_series(self.name, data_only: true) || raise("No series #{self} found in file #{path}")
    series_hash[:data_hash].reject! {|_, value| value == 1.0E+15 }
    new_transformation("loaded from static file <#{path}>", series_hash[:data_hash])
  end

  ## This is for code testing purposes - generate random series data within the ranges specified
  def Series.generate_random(freq, start_date = nil, end_date = nil, low_range = 0.0, high_range = 100.0, specific_points = {})
    freq = Series.frequency_from_code(freq) || freq.to_sym
    start_date ||= (Date.today - 5.years).send("#{freq}_d")   ## find the *_d methods in date_extension.rb
    end_date ||= Date.today.send("#{freq}_d")
    incr = 1
    if freq == :quarter
      freq = :month
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

  def Series.load_from_file(path, options)
    date_sens = path.include? '%'
    dp = DownloadProcessor.new(:manual, options.merge(path: path))
    descript = 'loaded from %s with options shown' % (date_sens ? "set of static files #{path}" : "static file <#{path}>")
    Series.new_transformation(descript, dp.get_data, frequency_from_code(options[:frequency]))
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

  def Series.load_api_clusters(cluster_id, geo)
    dhp = DataHtmlParser.new
    series_data = dhp.get_cluster_series(cluster_id, geo)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, 'A')
  end

  def Series.load_api_eia_aeo(route: nil, scenario: nil, seriesId: nil, frequency: 'annual', value_in: 'value')
    dhp = DataHtmlParser.new
    raise 'route, scenario, and seriesId are all required parameters' unless route && scenario && seriesId
    series_data = dhp.get_eia_v2_series(route, scenario, seriesId, frequency, value_in)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, code_from_frequency(frequency))
  end

  def Series.load_api_eia_steo(seriesId: nil, frequency: 'monthly', value_in: 'value')
    dhp = DataHtmlParser.new
    raise 'seriesId is a required parameter' unless seriesId
    series_data = dhp.get_eia_v2_series('steo', nil, seriesId, frequency, value_in)
    link = '<a href="%s">API URL</a>' % dhp.url
    name = "loaded data set from #{link} with parameters shown"
    if series_data.empty?
      name = "No data collected from #{link} - possibly redacted"
    end
    Series.new_transformation(name, series_data, code_from_frequency(frequency))
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

  def daily_census
    raise 'Cannot compute avg daily census on daily series' if frequency == 'day'
    self / days_in_period
  end

  def days_in_period
    new_data = {}
    data.each do |date, _|
      new_data[date] = date.days_in_period(frequency)
    end
    new_transformation("number of days in each #{frequency}", new_data, frequency)
  end

  def at(date, error: nil)  ## if error is set to true, method will raise exception on nil value
    if date === :last
      date = last_observation
    end
    unless date.class == Date
      date = Date.parse(date) rescue Date.new(Integer date) rescue raise('at: Date argument can be, e.g. 2000 or "2000-04-01"')
    end
    data[date] || error && raise("Series #{self} has no value at #{date}")
  end

  def units_at(date)
    dd = at(date)
    return nil if dd.nil?
    ## Next line is very inefficient, but this method is currently only used in production in one operation,
    ## where performance is not really a concern, and refactoring code to make this method faster makes no sense.
    div_by = data_points.find_by(date: date).data_source.div_by rescue 1.0
    dd / div_by
  end

  def tsd_date_range(start_date, end_date)
    freq = frequency
    multiplier = 1
    if freq == 'quarter' || freq == 'semi'
      multiplier = freq_per_freq(:month, freq)
      freq = 'month'  ## this assignment must come second, eh?
    end

    offset = 0
    dates = []
    begin
      next_date = start_date + (offset * multiplier).send(freq)
      dates.push(next_date)
      offset += 1
    end while next_date < end_date
    dates
  end

  def to_tsd
    lm = xseries.data_points.order(:updated_at).last.updated_at rescue Time.now
    start_date = first_observation
    end_date = last_observation
    day_switches = case frequency
                   when 'week' then '0         0000000'
                   when 'day'  then '0         1111111'
                   else             '0                '
                   end
    day_switches[10 + start_date.wday] = '1' if frequency == 'week'

    aremos_desc = AremosSeries.get(name).description rescue ''
    output = name_no_freq.ljust(16, ' ') + aremos_desc.ljust(64, ' ') + "\r\n"
    output += '%s/%s/%s' % [lm.month.to_s.rjust(34, ' '), lm.day.to_s.rjust(2, ' '), lm.year.to_s[2..3]]
    output += '0800'
    output += start_date.tsd_start(frequency)
    output += end_date.tsd_end(frequency)
    output += frequency_code + '  '
    output += day_switches
    output += "\r\n"

    sci_data = {}
    data.each do |date, _|
      sci_data[date] = ('%.6E' % units_at(date)).insert(-3, '00')
    end

    tsd_date_range(start_date, end_date).each_with_index do |date, i|
      value = sci_data[date] || '1.000000E+0015'
      output += value.to_s.rjust(15, ' ')
      output += "     \r\n" if (i + 1) % 5 == 0
    end
    space_padding = 80 - output.split("\r\n")[-1].length
    space_padding == 0 ? output : output + (' ' * space_padding) + "\r\n"
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
      errors.concat s.reload_sources(nightly: false, clear_first: clear_first)  ## hardcoding as NOT the series worker, because expecting to use
                                                          ## this code only for ad-hoc jobs from now on
      eval_statements.concat(s.data_sources_by_last_run.map {|ds| ds.get_eval_statement})
      already_run[s_name] = true
    end
  end

  def reload_sources(nightly: false, clear_first: false)
    series_success = true
    data_sources_by_last_run.each do |ds|
      success = true
      begin
        clear_param = clear_first ? [true] : []  ## this is a hack required so that the parameter default for reload_source() can work correctly. Please be sure you understand before changing.
        success = ds.reload_source(*clear_param) unless nightly && !ds.reload_nightly? && !(ds.is_history? && Date.today.day == 1) ## History loaders only nightly reload on the first of month.
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

  def Series.search_box(input_string, limit: 10000, user: nil)
    all = Series.joins(:xseries)
    univ = 'UHERO'
    conditions = []
    bindvars = []
    first_term = nil
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
          raise "Unknown universe #{univ}" unless Series.valid_universe(univ)
        when /^[+]/
          limit = tane.to_i
        when /^[=]/
          conditions.push %q{series.name = ?}
          bindvars.push tane
        when /^\^/
          conditions.push %Q{substring_index(series.name,'@',1) #{negated}regexp ?}
          bindvars.push '^(%s)' % tane.convert_commas
        when /^[~]/  ## tilde
          conditions.push %Q{substring_index(series.name,'@',1) #{negated}regexp ?}
          bindvars.push tane.convert_commas
        when /^[:]/
          if term =~ /^::/
            all = all.joins('left outer join sources on sources.id = series.source_id')
            conditions.push %Q{concat(coalesce(source_link,''),'|',coalesce(sources.link,'')) #{negated}regexp ?}
            bindvars.push tane[1..].convert_commas
          else
            conditions.push %Q{source_link #{negated}regexp ?}
            bindvars.push tane.convert_commas
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
          bindvars.push tane.convert_commas
        when /^[!]/
          all = all.joins('inner join data_sources as l2 on l2.series_id = series.id and not(l2.disabled)')
          conditions.push %q{l2.last_error regexp ?}
          bindvars.push tane.convert_commas
        when /^[;]/
          (res, id_list) = tane.split('=')
          rescol = { unit: 'unit_id', src: 'source_id', det: 'source_detail_id' }[res.to_sym] || raise("Unknown resource type #{res}")
          ids = id_list.split(',').map(&:to_i)
          qmarks = (['?'] * ids.count).join(',')
          conditions.push %Q{#{rescol} #{negated}in (#{qmarks})}
          bindvars.concat ids
        when /^[&]/
          conditions.push case tane.downcase
                          when 'pub' then %Q{restricted is #{negated}false}
                          when 'pct' then %Q{percent is #{negated}true}
                          when 'sa'  then %q{seasonal_adjustment = 'seasonally_adjusted'}
                          when 'ns'  then %q{seasonal_adjustment = 'not_seasonally_adjusted'}
                          when 'nodpn'  then %Q{dataPortalName is #{negated}null}
                          when 'nodata' then %q{(not exists(select * from data_points where xseries_id = xseries.id and current))}
                          when 'hasph'
                            all = all.joins('inner join data_sources as l3 on l3.series_id = series.id and not(l3.disabled)')
                            %q{l3.pseudo_history is true}  ## this cannot be negated for same reason '#' operator cannot
                          when 'noclip'
                            raise 'No user identified for clipboard access' if user.nil?
                            bindvars.push user.id.to_i
                            %q{(series.id not in (select series_id from user_series where user_id = ?))}
                          else raise("Unknown fixed term #{term}")
                          end
        when /^\d+\b/
          if conditions.count > 0
            term = (negated ? %q{-"} : %q{"}) + term
            redo
          end
          ### Series ID# or comma-separated list of same. Note that the loop becomes irrelevant. There should be nothing
          ### else in the box except a list of numbers, so we just break the loop after setting the conditions, etc.
          sids = input_string.gsub(/\s+/, '').split(',').map(&:to_i)
          qmarks = (['?'] * sids.count).join(',')
          conditions.push %Q{series.id in (#{qmarks})}
          bindvars = sids
          univ = nil  ## disable setting of the universe - not wanted for direct ID number access
          break
        when /^[{]/
          conditions.push %Q{dataPortalName #{negated}regexp ?}
          bindvars.push tane.convert_commas
        when /^[}]/
          conditions.push %Q{series.description #{negated}regexp ?}
          bindvars.push tane.convert_commas
        when /^[,]/
          raise 'Spaces cannot occur in comma-separated search lists'
        else
          if user && user.mnemo_search? && first_term.nil? && !negated    ## A special hack for special users ;=)
            first_term = term
            if term =~ /^[^"]/
              term = '^' + term
              redo
            end
          end
          conditions.push %Q{concat(substring_index(series.name,'@',1),'|',coalesce(dataPortalName,''),'|',coalesce(series.description,'')) #{negated}regexp ?}
          ## remove any quoting operator, handle doubled commas, and handle alternatives separated by comma
          bindvars.push term.sub(/^["']/, '').convert_commas
      end
    end
    if univ
      conditions.push %q{series.universe = ?}
      bindvars.push univ
    end
    all.distinct.where(conditions.join(' and '), *bindvars).limit(limit).sort_by(&:name)
  end

  def Series.web_search(search_string, universe)
    universe = 'UHERO' if universe.blank? ## cannot make this a param default because it is often == ''
    Rails.logger.debug { ">>>>>>>> Web searching for string |#{search_string}| in universe #{universe}" }
    series_results = Series.search_box("/#{universe} " + search_string, limit: 10)

    results = []
    series_results.each do |s|
      description = s.description ||
                    (AremosSeries.get(s.name).description rescue nil) ||
                    'no aremos series'
      results.push({ name: s.name, series_id: s.id, description: description})
    end

    if universe == 'UHERO'
      regex = /"([^"]*)"/
      search_terms = (search_string.scan(regex).map {|s| s[0] }) + search_string.gsub(regex, '').split(' ')
      conditions = [%q{coalesce(description,'') regexp ?}] * search_terms.count
      AremosSeries.where(conditions.join(' and '), *search_terms).limit(10).each do |as|
        s = as.name.tsnil
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

  def get_all_dependencies
    Series.get_all_dependencies([self.id])
  end

  def Series.get_all_dependencies(base_list)
    raise 'Series.get_all_dependencies takes an array of series ids' unless base_list.class == Array
    result_set = base_list
    next_set = base_list
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
        and dependencies regexp CONCAT(' ', series.name)
      SQL
      next_set = new_deps.map(&:id) - result_set
      result_set += next_set
    end
    result_set
  end

  def reload_with_dependencies(nightly: false, clear_first: false, group_size: nil, cycle_time: nil)
    Series.reload_with_dependencies([self.id], 'self', nightly: nightly, clear_first: clear_first, group_size: group_size, cycle_time: cycle_time)
  end

  def Series.reload_with_dependencies(series_id_list, suffix = 'adhoc', nightly: false, clear_first: false, group_size: nil, cycle_time: nil)
    raise 'Series.reload_with_dependencies takes an array of series ids' unless series_id_list.class == Array
    Rails.logger.info { 'reload_with_dependencies: start' }

    full_set = Series.get_all_dependencies(series_id_list)
    mgr = SeriesReloadManager.new(Series.where(id: full_set), suffix, nightly: nightly)
    load_params = {}  ## this is an awkward way to pass params, but the best way to ensure defaults in batch_reload() work as they should
    load_params.merge!(clear_first: clear_first) if clear_first
    load_params.merge!(group_size: group_size) if group_size
    load_params.merge!(cycle_time: cycle_time) if cycle_time
    Rails.logger.info { "Series.reload_with_dependencies: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
    mgr.batch_reload(load_params)
  end

  def source_link_is_valid
    source_link.blank? || Series.valid_url(source_link) || errors.add(:source_link, 'is not a valid URL')
  end

  def required_fields
    return true if no_enforce_fields?
    raise(SeriesMissingFieldException, 'Cannot save Series without Data Portal Name') if dataPortalName.blank?
    raise(SeriesMissingFieldException, 'Cannot save Series without Unit') if unit_id.blank?
    raise(SeriesMissingFieldException, 'Cannot save Series without Source') if source_id.blank?
    raise(SeriesMissingFieldException, 'Cannot save Series without Decimals') if decimals.blank?
    true
  end

  def no_enforce_fields?
    return true if universe != 'UHERO' ## only enforce for UHERO series
    return true if scratch == 11011  ## don't enforce because I said not to
    return true if scratch == 90909  ## don't enforce if in process of being destroyed
    return true if name =~ /test/i   ## don't enforce if name contains "TEST"
    false
  end

  def force_destroy!
    self.update_columns(scratch: 44444)  ## a flag to permit destruction even with certain inhibiting factors
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
    unless who_depends_on_me.empty? || destroy_forced?
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
      xseries.update_columns(primary_series_id: nil)  ## to avoid failure on foreign key constraint
      self.update_columns(scratch: 90909)  ## a flag to tell next callback to delete the xseries
    end
  end

  def post_mortem
    if scratch == 90909
      xseries.destroy!
    end
    Rails.logger.info { "DESTROY series #{self}: done" }
  end

  def destroy_forced?
    scratch == 44444
  end

  def Series.display_options(options)
    options.select{|k,_| ![:data_source, :eval_hash, :dont_skip].include?(k) }
  end

end
