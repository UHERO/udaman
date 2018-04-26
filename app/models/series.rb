class Series < ActiveRecord::Base
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

  validates :name, presence: true, uniqueness: true
  
  #serialize :data, Hash
  serialize :factors, Hash
  
  has_many :data_points
  has_many :data_sources
  has_many :data_source_actions, -> { order 'created_at DESC' }
  has_many :sidekiq_failures  ## really only has one, but stupid Rails error prevented relation from working with has_one :(

  has_and_belongs_to_many :data_lists

  belongs_to :source, inverse_of: :series
  belongs_to :source_detail, inverse_of: :series
  belongs_to :unit, inverse_of: :series
  belongs_to :geography, inverse_of: :series

  has_many :measurement_series, dependent: :delete_all
  has_many :measurements, through: :measurement_series

  enum seasonal_adjustment: { seas_adj_not_applicable: 'not_applicable',
                              seas_adj: 'seasonally_adjusted',
                              not_seas_adj: 'not_seasonally_adjusted' }

  after_create do
    self.update frequency: (Series.frequency_from_code(self.name.split('.').pop) || self.frequency)
  end

  def as_json(options = {})
    as = AremosSeries.get(self.name)
    desc = as.nil? ? '' : as.description
    {
      data: self.data,
      frequency: self.frequency,
      units: self.units,
      description: desc,
      source: self.original_url
    }
  end

  def Series.bulk_create(definitions)
    definitions.each { |definition| Kernel::eval definition }
    return true
  end
  
  def last_observation
    return nil if data.nil?
    data.keys.sort[-1]
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
    results = Series.get_all_uhero.where(frequency: frequency).select('data, updated_at')
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
  
  def Series.all_names
    Series.get_all_uhero.pluck(:name)
  end
  
  def Series.region_hash
    region_hash = {}
    all_names = Series.all_names
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
  
  #There are duplicates of these in other file... non series version 
  def Series.frequency_from_code(code)
    return :year if code == 'A' || code =='a'
    return :quarter if code == 'Q' || code =='q'
    return :month if code == 'M' || code == 'm'
    return :semi if code == 'S' || code == 's'
    return :week if code == 'W' || code == 'w'
    return :day if code == 'D' || code == 'd'
    return nil
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

  def Series.load_all_mean_corrected_sa_series_from(spreadsheet_path, sheet_to_load = nil)  
    each_spreadsheet_header(spreadsheet_path, sheet_to_load, true) do |series_name, update_spreadsheet|
      frequency_code = code_from_frequency update_spreadsheet.frequency  
      sa_base_name = series_name.sub('NS@','@')
      sa_series_name = sa_base_name+'.'+frequency_code
      ns_series_name = series_name+'.'+frequency_code
      
      demetra_series = new_transformation('demetra series', update_spreadsheet.series(series_name), frequency_code)
      
      Series.store(sa_series_name, Series.new(:frequency => update_spreadsheet.frequency, :data => demetra_series.data), spreadsheet_path, %Q^"#{sa_series_name}".tsn.load_sa_from "#{spreadsheet_path}", "#{sheet_to_load}"^) unless sheet_to_load.nil? 
      Series.store(sa_series_name, Series.new(:frequency => update_spreadsheet.frequency, :data => demetra_series.data), spreadsheet_path, %Q^"#{sa_series_name}".tsn.load_sa_from "#{spreadsheet_path}"^) if sheet_to_load.nil?

      unless ns_series_name.ts.nil?
        mean_corrected_demetra_series = demetra_series / demetra_series.annual_sum * ns_series_name.ts.annual_sum 
        Series.store(sa_series_name, Series.new(:frequency => update_spreadsheet.frequency, :data => mean_corrected_demetra_series.data), "mean corrected against #{ns_series_name} and loaded from #{spreadsheet_path}", %Q^"#{sa_series_name}".tsn.load_mean_corrected_sa_from "#{spreadsheet_path}", "#{sheet_to_load}"^) unless sheet_to_load.nil? 
        Series.store(sa_series_name, Series.new(:frequency => update_spreadsheet.frequency, :data => mean_corrected_demetra_series.data), "mean corrected against #{ns_series_name} and loaded from #{spreadsheet_path}", %Q^"#{sa_series_name}".tsn.load_mean_corrected_sa_from "#{spreadsheet_path}"^) if sheet_to_load.nil?
      end
      # sa_series_name.ts_eval=(%Q^"#{sa_series_name}".tsn.load_mean_corrected_sa_from "#{update_spreadsheet_path}", "#{sheet_to_load}"^) unless sheet_to_load.nil? 
      # sa_series_name.ts_eval=(%Q^"#{sa_series_name}".tsn.load_mean_corrected_sa_from "#{update_spreadsheet_path}"^) if sheet_to_load.nil? 
      #Series.store(sa_series_name, Series.new(:frequency => update_spreadsheet.frequency, :data => update_spreadsheet.series(series_name)), update_spreadsheet_path, %Q^"#{sa_series_name}".tsn.load_sa_from "#{update_spreadsheet_path}"^)
      #sa_series_name.ts.update_attributes(:seasonally_adjusted => true, :last_demetra_datestring => update_spreadsheet.dates.keys.sort.last)
      sa_series_name
      
      
            
      
      # demetra_series.frequency = update_spreadsheet.frequency
      # self.frequency = update_spreadsheet.frequency
      # mean_corrected_demetra_series = demetra_series / demetra_series.annual_sum * ns_name.ts.annual_sum
      # new_transformation("mean corrected against #{ns_name} and loaded from #{update_spreadsheet_path}", mean_corrected_demetra_series.data)
      
      
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
  
  def Series.get(series_name)  
    headerparts = series_name.split('.')
    if headerparts.count == 2
      name_match = Series.where(:name => series_name).first #exact name_match
      return name_match #unless name_match.nil?
      #return Series.first :conditions => {:name=>headerparts[0], :frequency=>frequency_from_code(headerparts[1])} #same base name and correct frequency
    else
      raise SeriesNameException
    end    
  end

  def Series.get_all_uhero
    Series.where(%q{series.universe like 'UHERO%'})
  end

  def Series.get_or_new(series_name)
    Series.get(series_name) || Series.create_new({ name: series_name })
  end

  def Series.create_new(properties)
    name_parts = properties.delete(:name_parts)
    if name_parts  ## called from SeriesController#create
      geo = Geography.find(name_parts[:geo_id]) || raise("No geography (id=#{name_parts[:geo_id]}) found for series creation")
    else
      name_parts = Series.parse_name(properties[:name]) || raise("Series name '#{properties[:name]}' format invalid")
      geo = Geography.find_by(universe: 'UHERO', handle: name_parts[:geo]) ||
              raise("No UHERO geography (handle=#{name_parts[:geo]}) found for series creation")
    end
    properties[:name] = Series.build_name([ name_parts[:prefix], geo.handle, name_parts[:freq] ])
    properties[:geography_id] = geo.id
    properties[:frequency] = Series.frequency_from_code(name_parts[:freq])
    Series.create( properties.map {|k,v| [k, v.blank? ? nil : v] }.to_h ) ## don't put empty strings in the db.
  end

  def Series.parse_name(name)
    name =~ /^(\S+?)@(\w+?)\.([ASQMWDasqmwd])$/ ? { prefix: $1, geo: $2, freq: $3.upcase } : nil
  end

  def parse_name
    name =~ /^(\S+?)@(\w+?)\.([ASQMWDasqmwd])$/ ? { prefix: $1, geo: $2, freq: $3.upcase } : nil
  end

  def Series.build_name(parts)
    name = parts[0].strip.upcase + '@' + parts[1].strip.upcase + '.' + parts[2].strip.upcase
    Series.parse_name(name) ? name : raise("Build series name: '#{name}' format invalid")
  end

  def Series.store(series_name, series, desc=nil, eval_statement=nil, priority=100)
    desc = series.name if desc.nil?
    desc = 'Source Series Name is blank' if desc.blank?
    series_to_set = series_name.tsn
    series_to_set.frequency = series.frequency
    source = series_to_set.save_source(desc, eval_statement, series.data, priority)
    source
  end

  def Series.eval(series_name, eval_statement, priority=100)
    t = Time.now
    new_series = Kernel::eval eval_statement
    Series.store series_name, new_series, new_series.name, eval_statement, priority
    puts "#{'%.2f' % (Time.now - t)} | #{series_name} | #{eval_statement}"
  end
  
  def save_source(source_desc, eval_statement, data, priority=100, last_run = Time.now)
    source = nil
    data_sources.each do |ds|
      if !eval_statement.nil? and !ds.eval.nil? and eval_statement.strip == ds.eval.strip
        ds.update_attributes(:last_run => Time.now)
        source = ds 
      end
    end
       
    if source.nil?
      data_sources.create(
        :description => source_desc,
        :eval => eval_statement,
        :priority => priority,
        :last_run => last_run
      )
    
      source = data_sources_by_last_run[-1]
      source.setup
    end
    update_data(data, source)
    source
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
    observation_dates = observation_dates - current_data_points.map {|dp| dp.date}
    observation_dates.each do |date|
      data_points.create(
        :date => date,
        :value => data[date],
        :created_at => Time.now,
        :current => true,
        :data_source_id => source.id
      )
    end
    DataPoint.update_public_data_points(universe.sub(/^UHERO.*/, 'UHERO'), self) unless self.quarantined?
    aremos_comparison #if we can take out this save, might speed things up a little
    []
  end

  def add_to_quarantine(run_update = true)
    self.update! quarantined: true
    DataPoint.update_public_data_points(universe.sub(/^UHERO.*/, 'UHERO'), self) if run_update
  end

  def remove_from_quarantine(run_update = true)
    raise 'Trying to remove unquarantined series from quarantine' unless quarantined?
    self.update! quarantined: false
    DataPoint.update_public_data_points(universe.sub(/^UHERO.*/, 'UHERO'), self) if run_update
  end

  def Series.empty_quarantine
    Series.get_all_uhero.where(quarantined: true).update_all quarantined: false
    DataPoint.update_public_data_points(universe.sub(/^UHERO.*/, 'UHERO'))
  end

  def update_data_hash
    data_hash = {}
    data_points.each do |dp|
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

  def extract_from_datapoints(column)
    hash = {}
    data_points.each do |dp|
      hash[dp.date] = dp[column] if dp.current
    end
    hash
  end
  
  def scaled_data_no_pseudo_history(round_to = 3)
    data_hash = {}
    self.units ||= 1
    self.units = 1000 if name[0..2] == 'TGB' #hack for the tax scaling. Should not save units
    data_points.each do |dp|
      data_hash[dp.date] = (dp.value / self.units).round(round_to) if dp.current and !dp.pseudo_history
    end
    data_hash
  end
  
  def scaled_data(round_to = 3)
    data_hash = {}
    self.units ||= 1
    self.units = 1000 if name[0..2] == 'TGB' #hack for the tax scaling. Should not save units
    # data_points.each do |dp|
    #   data_hash[dp.date_string] = (dp.value / self.units).round(round_to) if dp.current
    # end
    sql = %[
      SELECT round(value/#{self.units}, #{round_to}) AS value, date
      FROM data_points WHERE series_id = #{self.id} AND current = 1;
    ]
    ActiveRecord::Base.connection.execute(sql).each(:as => :hash) do |row|
      data_hash[row['date']] = row['value']
    end
    data_hash
  end
  
  def Series.new_from_data(frequency, data)
    Series.new_transformation('One off data', data, frequency)
  end
  
  def Series.new_transformation(name, data, frequency)
    Series.new(
      :name => name,
      :frequency => frequency,
      :data => data
    )
  end
  
  def new_transformation(name, data)
    frequency = (self.frequency.nil? and name.split('.').count == 2 and name.split('@').count == 2 and name.split('.')[1].length == 1) ? Series.frequency_from_code(name[-1]) : self.frequency
    #puts "NEW TRANFORMATION: #{name} - frequency: #{frequency} | frequency.nil? : #{self.frequency.nil?} | .split 2 :#{name.split('.').count == 2} | @split 2 : #{name.split('@') == 2} |"# postfix1 : #{name.split('.')[1].length == 1}"  
    Series.new(
      :name => name,
      :frequency => frequency,
      :data => Hash[data.reject {|_, v| v.nil?}.map {|date, value| [(Date.parse date.to_s), value]}]
    )
  end
  
  #need to spec out tests for this
  #this would benefit from some caching scheme
  
  #SeriesReloadExceptions
  #until we can figure out a solid for sources ordering, this error is particularly costly
  #just keeping data the same if there's a problem to preserve the order.
  
  def load_from(spreadsheet_path, sheet_to_load = nil)
    spreadsheet_path.gsub! ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH']
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)
    raise SeriesReloadException, 'load error' if update_spreadsheet.load_error?
    #return self if update_spreadsheet.load_error?

    unless update_spreadsheet.class == UpdateCSV
      default_sheet = update_spreadsheet.sheets.first
      update_spreadsheet.default_sheet = sheet_to_load.nil? ? default_sheet : sheet_to_load
    end
    raise SeriesReloadException, 'update not formatted' unless update_spreadsheet.update_formatted?
    #return self unless update_spreadsheet.update_formatted?
    
    self.frequency = update_spreadsheet.frequency
    new_transformation(spreadsheet_path, update_spreadsheet.series(self.name))
  end
    
  
  def load_sa_from(spreadsheet_path, sheet_to_load = nil)
    spreadsheet_path.gsub! ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH']
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)
    #raise SeriesReloadException if update_spreadsheet.load_error?
    if update_spreadsheet.load_error?
      return self
    end

    ns_name = self.name.sub('@', 'NS@')
#    default_sheet = update_spreadsheet.sheets.first unless update_spreadsheet.class == UpdateCSV
    update_spreadsheet.default_sheet = sheet_to_load.nil? ? 'sadata' : sheet_to_load unless update_spreadsheet.class == UpdateCSV
    #raise SeriesReloadException unless update_spreadsheet.update_formatted?
    unless update_spreadsheet.update_formatted?
      return self
    end
    
    self.frequency = update_spreadsheet.frequency 
    new_transformation(spreadsheet_path, update_spreadsheet.series(ns_name))
  end
    
  
  def load_mean_corrected_sa_from(spreadsheet_path, sheet_to_load = nil)
    spreadsheet_path.gsub! ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH']
    update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(spreadsheet_path)

    #raise SeriesReloadException if update_spreadsheet.load_error?
    if update_spreadsheet.load_error?
      return self
    end

    ns_name = self.name.sub('@', 'NS@')
    unless update_spreadsheet.class == UpdateCSV
      # default_sheet = update_spreadsheet.sheets.first
      update_spreadsheet.default_sheet = sheet_to_load.nil? ? 'sadata' : sheet_to_load
    end
    #raise SeriesReloadException unless update_spreadsheet.update_formatted?
    unless update_spreadsheet.update_formatted?
      return self
    end
    
    demetra_series = new_transformation('demetra series', update_spreadsheet.series(ns_name))
    demetra_series.frequency = update_spreadsheet.frequency.to_s
    self.frequency = update_spreadsheet.frequency
    mean_corrected_demetra_series = demetra_series / demetra_series.annual_sum * ns_name.ts.annual_sum
    new_transformation("mean corrected against #{ns_name} and loaded from #{spreadsheet_path}", mean_corrected_demetra_series.data)
  end
  
  def Series.load_from_download(handle, options, cached_files = nil)
    dp = DownloadProcessor.new(handle, options)
    series_data = dp.get_data
    Series.new_transformation("loaded from download #{handle} with options:#{Series.display_options(options)}",
                               series_data,
                               Series.frequency_from_code(options[:frequency]))
  end
  
  def Series.load_from_file(file, options, cached_files = nil)
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
  
  def load_from_download(handle, options, cached_files = nil)
    dp = DownloadProcessor.new(handle, options)
    series_data = dp.get_data
    new_transformation("loaded from download #{handle} with options:#{Series.display_options(options)}", series_data)
  end
  
  def Series.load_from_bea(frequency, dataset, parameters)
    series_data = DataHtmlParser.new.get_bea_series(dataset, parameters)
    Series.new_transformation("loaded dataset #{dataset} with parameters #{parameters} from BEA API", series_data, Series.frequency_from_code(frequency))
  end
  
  def load_from_bea(dataset, parameters)
    frequency = Series.frequency_from_code(self.name.split('.')[1])
    series_data = DataHtmlParser.new.get_bea_series(dataset, parameters)
    Series.new_transformation("loaded dataset #{dataset} with parameters #{parameters} for region #{region} from BEA API", series_data, frequency)
  end
  
  def Series.load_from_bls(code, frequency)
    series_data = DataHtmlParser.new.get_bls_series(code,frequency)
    Series.new_transformation("loaded series code: #{code} from bls website", series_data, Series.frequency_from_code(frequency))
  end
  
  def load_from_bls(code, frequency = nil)
    series_data = DataHtmlParser.new.get_bls_series(code,frequency)
    new_transformation("loaded series code: #{code} from bls website", series_data)
  end
  
  #it seems like these should need frequencies...
  def load_from_fred(code)
    series_data = DataHtmlParser.new.get_fred_series(code)
    new_transformation("loaded series : #{code} from FRED website", series_data)
  end
  
  def days_in_period
    series_data = {}
    data.each {|date, _| series_data[date] = date.to_date.days_in_period(self.frequency) }
    Series.new_transformation('days in time periods', series_data, self.frequency)
  end
  
  def Series.load_from_fred(code, frequency = nil, aggregation_method = nil)
    series_data = DataHtmlParser.new.get_fred_series(code, frequency, aggregation_method)
    Series.new_transformation("loaded series : #{code} from FRED website", series_data, Series.frequency_from_code(frequency))
  end
  
  def Series.where_ds_like(string)
    ds_array = DataSource.where("eval LIKE '%#{string}%'").all
    series_array = []
    ds_array.each do |ds|
      series_array.push ds.series
    end 
    series_array
  end
  
  def ds_like?(string)
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

  # def get_source_colors
  #   colors = {}
  #   color_order = ["FFCC99", "CCFFFF", "99CCFF", "CC99FF", "FFFF99", "CCFFCC", "FF99CC", "CCCCFF", "9999FF", "99FFCC"]
  #   colors
  # end

  def print
    data.sort.each do |date, value|
      puts "#{date}: #{value}"
    end
    puts name
  end
  
  def new_data?
    data_points.where('created_at > FROM_DAYS(TO_DAYS(NOW()))').count > 0
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
  
  def print_data_points
    data_hash = {}
    source_array = []
    
    data_sources.each { |ds| source_array.push ds.id }  
    source_array.each_index {|index| puts "(#{index}) #{DataSource.find_by(id: source_array[index]).eval}"}
    data_points.each do |dp|  
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
    
    #return self.data.keys.sort 
      
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

  def Series.new_from_tsd_data(tsd_data)
    return Series.new_transformation(tsd_data['name']+'.'+tsd_data['frequency'],  tsd_data['data'], Series.frequency_from_code(tsd_data['frequency']))
  end
  
  def get_tsd_series_data(tsd_file)      
    url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{name.split('.')[0].gsub('%', '%25')}/json")
    res = Net::HTTP.new(url.host, url.port).request_get(url.path)
    tsd_data = res.code == '500' ? nil : JSON.parse(res.body)
    
    return nil if tsd_data.nil?
    clean_tsd_data = {}
    tsd_data['data'].each {|date_string, value| clean_tsd_data[Date.strptime(date_string, '%Y-%m-%d')] = value}
    tsd_data['data'] = clean_tsd_data
    Series.new_from_tsd_data(tsd_data)
  end
  
  def tsd_string
    data_string = ''
    lm = data_points.order(:updated_at).last.updated_at

    as = AremosSeries.get name
    as_description = as.nil? ? '' : as.description

    dps = data
    dates = dps.keys.sort
    
    #this could stand to be much more sophisticated and actually look at the dates. I think this will suffice, though - BT
    day_switches = '0                '
    day_switches = '0         0000000' if frequency == 'week'
    day_switches[10 + dates[0].wday] = '1'    if frequency == 'week'
    day_switches = '0         1111111' if frequency == 'day'
    
    data_string+= "#{name.split('.')[0].to_s.ljust(16, ' ')}#{as_description.ljust(64, ' ')}\r\n"
    data_string+= "#{lm.month.to_s.rjust(34, ' ')}/#{lm.day.to_s.rjust(2, ' ')}/#{lm.year.to_s[2..4]}0800#{dates[0].tsd_start(frequency)}#{dates[-1].tsd_end(frequency)}#{Series.code_from_frequency frequency}  #{day_switches}\r\n"
    sci_data = {}
    
    dps.each do |date, _|
      sci_data[date] = ('%.6E' % units_at(date)).insert(-3, '00')
    end
    
    
    dates = date_range
    dates.each_index do |i|
    # sci_data.each_index do |i|
      date = dates[i]
      dp_string = sci_data[date].nil? ? '1.000000E+0015'.rjust(15, ' ') : sci_data[date].rjust(15, ' ')
      data_string += dp_string
      data_string += "     \r\n" if (i+1)%5==0
    end    
    space_padding = 80 - data_string.split("\r\n")[-1].length
    space_padding == 0 ? data_string : data_string + ' ' * space_padding + "\r\n"
  end
  
  #["ERE", "EGVLC", "EGVST", "EGVFD", "EAFFD", "EAFAC", "EAE", "EHC", "EED", "EPS", "EAD", "EMA","E_TU","EWT","ERT","ECT","EMN","EIF", "EOS", "E_TTU", "E_TRADE", "E_FIR", "E_PBS","E_EDHC", "E_LH", "EAF", "EGV", "E_GVSL", "E_NF"].each do |pre|
  
  def refresh_all_datapoints
    unique_ds = {} #this is actually used ds
    current_data_points.each {|dp| unique_ds[dp.data_source_id] = 1}
    puts unique_ds
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
    
  def last_data_added
    self.data_points.order(:created_at).last.created_at
  end
  
  def last_data_added_string
    last_data_added.strftime('%B %e, %Y')
  end
  
  def Series.get_all_series_by_eval(patterns)
    if patterns.class == String
      patterns = [patterns]
    end
    names = []
    all_uhero = DataSource.get_all_uhero
    patterns.each do |pat|
      pat.gsub!('%','\%')
      names += all_uhero.where("eval LIKE '%#{pat}%'").joins(:series).pluck(:name)
    end
    names = names.uniq
    Series.where(name: names
                         .concat(names.map{|s| logger.debug{ s }; s.ts.recursive_dependents }.flatten)
                         .uniq)
  end
  
  #currently runs in 3 hrs (for all series..if concurrent series could go first, that might be nice)
  #could do everything with no dependencies first and do all of those in concurrent fashion...
  #to find errors, or broken series, maybe update the ds with number of data points loaded on last run?
  
  def Series.run_all_dependencies(series_list, already_run, errors, eval_statements, clear_first = false)
    series_list.each do |s_name|
      next unless already_run[s_name].nil?
      s = s_name.ts
      begin
        Series.run_all_dependencies(s.new_dependencies, already_run, errors, eval_statements)
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
    
  def Series.missing_from_aremos
    name_buckets = {}
    (AremosSeries.all_names - Series.all_names).each {|name| name_buckets[name[0]] ||= []; name_buckets[name[0]].push(name)}
    name_buckets.each {|letter, names| puts "#{letter}: #{names.count}"}
    name_buckets
  end
  
  
  def Series.web_search(search_string, num_results = 10)
    regex = /"([^"]*)"/
    search_parts = (search_string.scan(regex).map {|s| s[0] }) + search_string.gsub(regex, '').split(' ')
    name_where = search_parts.map {|s| "name LIKE '%#{s}%'" }.join(' AND ')
    desc_where = search_parts.map {|s| "description LIKE '%#{s}%'" }.join(' AND ')
    dpn_where = search_parts.map {|s| "dataPortalName LIKE '%#{s}%'" }.join(' AND ')

    series_results = Series.get_all_uhero.
                        where("((#{name_where}) OR (#{desc_where}) OR (#{dpn_where}))").
                        limit(num_results)

    aremos_desc_where = (search_parts.map {|s| "description LIKE '%#{s}%'"}).join (' AND ')
    aremos_desc_results = AremosSeries.where(aremos_desc_where).limit(num_results)
    
    results = []
  
    series_results.each do |s|
      as = AremosSeries.get(s.name)
      description = 'no aremos series'
      description = as.description unless as.nil?
      description = s.description unless s.description.nil?
      results.push({ :name => s.name, :series_id => s.id, :description => description})
      #puts "#{s.id} : #{s.name} - #{as.nil? ? "no aremos series" : as.description}"
    end
    
    aremos_desc_results.each do |as|
      s = as.name.ts
      results.push({:name => as.name, :series_id => s.nil? ? 'no series' : s.id, :description => as.description})
      #puts "#{s.nil? ? "no series" : s.id}  : #{as.name} - #{as.description}"
    end
    
    results
    
  end

  def Series.assign_dependency_depth
    Rails.logger.info { "Assign_dependency_depth: start at #{Time.now}" }
    ActiveRecord::Base.connection.execute(<<~SQL)
      CREATE TEMPORARY TABLE IF NOT EXISTS t_series (PRIMARY KEY idx_pkey (id), INDEX idx_name (name))
          SELECT id, `name`, 0 AS dependency_depth FROM series WHERE universe LIKE 'UHERO%'
    SQL
    ActiveRecord::Base.connection.execute(<<~SQL)
      CREATE TEMPORARY TABLE IF NOT EXISTS t_datasources (INDEX idx_series_id (series_id))
          SELECT id, series_id, dependencies FROM data_sources WHERE universe LIKE 'UHERO%'
    SQL
    ActiveRecord::Base.connection.execute(<<~SQL)   ### Only needed because #braindead MySQL :(
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

    # notify if the dependency tree did not terminate
    if current_depth_count > 0
      PackagerMailer.circular_series_notification(Series.get_all_uhero.where(dependency_depth: previous_depth))
    end
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

  def Series.reload_with_dependencies(series_id_list)
    unless series_id_list.class == Array
      raise 'Series.reload_with_dependencies needs an array of series ids'
    end
    logger.info { "reload_with_dependencies: start" }
    result_set = series_id_list
    next_set = series_id_list
    until next_set.empty?
      logger.debug { "reload_with_dependencies: next_set is #{next_set}" }
      qmarks = next_set.count.times.map{ '?' }.join(',')
      ## So wackt that find_by_sql works this way :( But if it's fixed in Rails 5, remove this comment :)
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
    logger.info { "reload_with_dependencies: ship off to reload_by_dependency_depth" }
    Series.reload_by_dependency_depth Series.where id: result_set
  end

  def Series.reload_by_dependency_depth(series_list = Series.get_all_uhero)
    require 'redis'
    redis = Redis.new
    logger.info { 'Starting Reload by Dependency Depth' }
    first_depth = series_list.order(:dependency_depth => :desc).first.dependency_depth
    batch_id = Time.now.strftime('%Y%m%d%H%MUTC') + '_' + series_list.count.to_s
    redis.pipelined do
      redis.set("current_depth_#{batch_id}", first_depth)
      redis.set("waiting_workers_#{batch_id}", 0)
      redis.set("busy_workers_#{batch_id}", 0)
      redis.set("finishing_depth_#{batch_id}", false)
      redis.set("series_list_#{batch_id}", series_list.pluck(:id))
      redis.set("queue_#{batch_id}", series_list.where(:dependency_depth => first_depth).count)
    end
    # set the current depth
    series_list.where(:dependency_depth => first_depth).pluck(:id).each do |series_id|
      SeriesWorker.perform_async series_id, batch_id
    end
  end

  def Series.check_for_stalled_reload(series_size = Series.get_all_uhero.count)
    require 'redis'
    require 'sidekiq/api'
    redis = Redis.new

    sidekiq_stats = Sidekiq::Stats.new
    current_depth = redis.get("current_depth_#{series_size}").to_i

    if current_depth > 0 && sidekiq_stats.enqueued == 0 && sidekiq_stats.retry_size == 0 &&  sidekiq_stats.workers_size == 0
      puts "Jump starting stalled reload (#{series_size})"
      next_depth = current_depth - 1
      redis.set("current_depth_#{series_size}", next_depth)
      series_ids = redis.get("series_list_#{series_size}").scan(/\d+/).map{|s| s.to_i}
      next_series = Series.all.where(:id => series_ids, :dependency_depth => next_depth)
      redis.pipelined do
        redis.set("queue_#{series_size}", next_series.count)
        redis.set("finishing_depth_#{series_size}", false)
        redis.set("busy_workers_#{series_size}", 1)
      end
      next_series.pluck(:id).each do |id|
        SeriesWorker.perform_async id, series_size
      end
      puts "Queued depth #{next_depth} (#{series_size})"
    end
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


private
  def Series.display_options(options)
    options.select{|k,_| ![:data_source, :eval_hash, :dont_skip].include?(k) }
  end

end
