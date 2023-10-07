class DataHtmlParser
  include HelperUtilities

  def get_fred_series(code, frequency = nil, aggregation_method = nil)
    api_key = ENV['API_KEY_FRED'] || raise('No API key defined for FRED')
    @url = "http://api.stlouisfed.org/fred/series/observations?api_key=#{api_key}&series_id=#{code}"
    if frequency ## d, w, bw, m, q, sa, a (udaman represents semiannual frequency with S)
      @url += "&frequency=#{frequency.downcase.sub(/^s$/, 'sa')}"
    end
    if aggregation_method ## avg, sum, eop
      @url += "&aggregation_method=#{aggregation_method.downcase}"
    end
    doc = self.download
    err = doc.css('error')
    raise 'FRED API Error: %s (code=%s)' % [err[:message], err[:code]] if err

    data = {}
    doc.css('observation').each do |obs|
      next if obs[:value] == '.'
      data[ grok_date(obs[:date]) ] = obs[:value].to_f
    end
    data
  end
  
  def get_bls_series_ONHOLD(series_id, _ = nil)
    api_key = ENV['API_KEY_BLS'] || raise('No API key defined for BLS')
    thisyear = Date.today.year
    @url = 'https://api.bls.gov/publicAPI/v2/timeseries/data/%s?registration_key=%s&startyear=%d&endyear=%d' %
      [series_id, api_key, thisyear - 9, thisyear]
    Rails.logger.debug { "Getting data from BLS API: #{@url}" }
    @doc = self.download
    raise 'BLS API: empty response returned' if self.content.blank?
    json = JSON.parse(self.content) rescue raise('BLS API: JSON parse failure')
    unless json['status'] =~ /succeeded/i
      raise 'BLS API error: %s' % json['message'].join(' ')
    end
    results_data = json['Results']['series'][0]['data']  ## :eyeroll
    raise 'BLS API error: %s' % json['message'].join(' ') if results_data.empty?

    new_data = {}
    results_data.each do |dp|
      new_data[ grok_date(dp['year'], dp['period']) ] = dp['value'].gsub(',','').to_f
    end
    new_data
  end

  ## Should be obsolete now, but let's keep it around a while longer just in case a problem arises
  ## with the new routine above
  def get_bls_series(code, frequency = nil)
    @code = code
    @url = 'https://data.bls.gov/pdq/SurveyOutputServlet'
    @post_parameters = {
        :data_tool =>'srgate',
        :delimeter =>'tab',
        :initial_request =>'false',
        :output_format =>'text',
        :output_type =>'column',
        :periods_option =>'all_periods',
        :reformat =>'true',
        :series_id => code,
        :years_option =>'all_years'
    }
    @doc = self.download
    avail_freqs = data.keys
    frequency ||= avail_freqs[0]
    if avail_freqs.count > 0 && !avail_freqs.include?(frequency)
      raise "BLS API: #{code} has no data at frequency #{frequency}, only #{avail_freqs.join(', ')}"
    end
    data[frequency]
  end

  def get_bea_series(dataset, filters)
    api_key = ENV['API_KEY_BEA'] || raise('No API key defined for BEA')
    query_pars = filters.map {|k,v| "#{k}=#{v}" }.join('&')
    @url = "https://apps.bea.gov/api/data/?UserID=#{api_key}&method=GetData&datasetname=#{dataset}&#{query_pars}&ResultFormat=JSON&"
    Rails.logger.debug { "Getting data from BEA API: #{@url}" }
    @doc = self.download
    raise 'BEA API: empty response returned' if self.content.blank?
    response = JSON.parse(self.content) rescue raise('BEA API: JSON parse failure')
    beaapi = response['BEAAPI'] || raise('BEA API: major unknown failure')
    raise 'BEA API: no results included' unless beaapi['Results'] || beaapi['Error']
    err = beaapi['Error'] || beaapi['Results'] && beaapi['Results']['Error']
    if err
      raise 'BEA API Error: %s %s (code=%s)' % [
        err['APIErrorDescription'],
        err['ErrorDetail'] && err['ErrorDetail']['Description'],
        err['APIErrorCode']
      ]
    end
    results_data = beaapi['Results']['Data']
    raise 'BEA API: results, but no data' unless results_data

    new_data = {}
    results_data.each do |data_point|
      next unless request_match(filters, data_point)
      tp = data_point['TimePeriod']
      date = grok_date(tp[0..3], tp[4..])
      value = data_point['DataValue'].strip.gsub(',', '') rescue nil  ## nil if DataValue field is entirely missing
      if value.nil? || data_point['NoteRef'].strip =~ /^\(\w+\)$/i
        value = 1.00E+0015  ## marks non-existent data point
      end
      new_data[date] = value.to_f rescue raise("Problem with value at #{date}")
    end
    new_data
  end

  def get_estatjp_series(code, filters)
    #### NOTE: This routine is written to collect ONLY monthly data
    api_key = ENV['API_KEY_ESTATJP'] || raise('No API key defined for ESTATJP')
    api_version = '3.0'
    query = filters.keys.map {|key| 'cd%s=%s' % [key.to_s.titlecase, filters[key]] }.join('&')
    @url = "https://api.e-stat.go.jp/rest/#{api_version}/app/json/getStatsData?" +
           "appId=#{api_key}&statsDataId=#{code}&#{query}&lang=E&metaGetFlg=Y&sectionHeaderFlg=1"
    Rails.logger.debug { "Getting data from ESTATJP API: #{@url}" }
    @doc = self.download
    raise 'ESTATJP API: empty response returned' if self.content.blank?
    json = JSON.parse(self.content) rescue raise('ESTATJP API: JSON parse failure')
    apireturn = json['GET_STATS_DATA'] || raise('ESTATJP: major unknown failure')
    if apireturn['RESULT']['STATUS'] != 0
      raise 'ESTATJP Error: %s' % apireturn['RESULT']['ERROR_MSG']
    end
    statdata = apireturn['STATISTICAL_DATA'] || raise('ESTATJP: no results included')
#    if statdata['CLASS_INF']['CLASS_OBJ'].select{|h| h['@id'] == 'time' && h['@name'] =~ /#{frequency}/i }.empty?
#      raise "ESTATJP: Expecting data with freq type #{frequency}, but seems we did not get it"
#    end
    results = statdata['DATA_INF'] && statdata['DATA_INF']['VALUE'] || raise('ESTATJP: results, but no data')

    new_data = {}
    results.each do |data_point|
      next unless estatjp_filter_match(filters, data_point)
      time_period = data_point['@time']
      next if time_period[-2..] == '00'
      value = data_point['$']  ## apparently all values are money, even when they're not ;)
      if value && value.gsub(',','').is_numeric?
        new_data[ grok_date(time_period[0..3], time_period[-2..]) ] = value.gsub(',','').to_f
      end
    end
    new_data
  end

  def get_cluster_series(cluster_id, geo, value_in: 'emp_tl')
    geocodes = { HI: 'state/15', HAW: 'county/15001', HON: 'county/15003', KAU: 'county/15007', MAU: 'county/15009' }
    geoinfo = geocodes[geo.upcase.to_sym] || raise("Invalid geography #{geo}")
    ##years = (2008..2020).to_a.join(',')   ## should be replaced with "all" as soon as that returns proper results
    @url = "https://clustermapping.us/data/region/#{geoinfo}/all/#{cluster_id}"
    Rails.logger.debug { "Getting data from Clustermapping API: #{@url}" }
    @doc = self.download
    raise 'Clustermapping API: empty response returned' if self.content.blank?
    response = JSON.parse(self.content) rescue raise('Clustermapping API: JSON parse failure')
    new_data = {}
    response.each do |data_point|
      time_period = data_point['year_t']
      value = data_point[value_in]
      if value
        new_data[ grok_date(time_period[0..3], time_period[4..]) ] = value
      end
    end
    new_data
  end

  def get_eia_v2_series(route, scenario, seriesId, frequency, value_in)
    api_key = ENV['API_KEY_EIA'] || raise('No API key defined for EIA')
    @url = 'https://api.eia.gov/v2/%s/data?api_key=%s' % [route, api_key]
    @url += '&facets[scenario][]=%s' % scenario if scenario
    @url += '&facets[seriesId][]=%s' % seriesId if seriesId
    @url += '&frequency=%s' % frequency if frequency
    @url += '&data[]=%s' % value_in if value_in
    Rails.logger.info { "Getting data from EIA API: #{@url}" }
    @doc = self.download
    raise 'EIA API: Null response returned; check parameters, they are case-sensitive' if self.content.blank?
    response = JSON.parse(self.content) rescue raise('EIA API: JSON parse failure')
    if response['error']
      raise 'EIA API error: %s' % (response['error']['message'] || response['error'])
    end
    api_data = response['response']['data']
    if api_data.empty?
      raise 'EIA API: Response is empty; check parameters, they are case-sensitive'
    end
    new_data = {}
    api_data.each do |data_point|
      date = grok_date(data_point['period'])
      new_data[date] = data_point[value_in].to_f
    end
    new_data
  end

  def get_dvw_series(mod, freq, indicator, dimension_hash)
    dims = dimension_hash.map {|k, v| '%s=%s' % [k.to_s[0].downcase, v] }.join('&')
    @url = "https://api.uhero.hawaii.edu/dvw/series/#{mod.downcase}?f=#{freq}&i=#{indicator}&#{dims}"
    Rails.logger.debug { 'Getting data from DVW API: ' + @url }
    @doc = self.download
    raise 'DVW API: empty response returned' if self.content.blank?
    json = JSON.parse(self.content) rescue raise('DVW API: JSON parse failure')
    results = json['data'] || raise('DVW API: failure - no data returned')
    dates = results['series'][0]['dates'] rescue raise('DVW API: failure - no series data found')
    values = results['series'][0]['values']
    new_data = {}
    dates.each_with_index do |date, index|
      new_data[date] = values[index]
    end
    new_data
  end

  def request_match(request, data_point)
    dp = data_point.map{|k,v| [k.upcase, v] }.to_h
    request.keys.each do |key|
      dp_value = dp[key.upcase.to_s].to_s
      if !dp_value.blank? && request[key].to_s.strip.upcase !~ /^(ANY|X)$/ && dp_value != request[key].to_s
        Rails.logger.debug { "Rejected match: key=#{key}, dp has '#{dp_value}'" }
        return false
      end
    end
    true
  end

  def doc
    @doc
  end
  
  def content
    @content
  end

  def url
    @url
  end

  def bls_text
    @doc.css('pre').text   ## This 'pre' has to be lower case for some strange reason
  end
  
  def get_data
    data_hash ||= {}
    resp = bls_text
    raise "BLS API: #{resp.strip}" if resp =~ /error/i

    data_lines = resp.split("\n")
    data_lines.each do |dl|
      next unless dl.index(@code) == 0
     ## this should be uncommented sometime... next if cols[3].blank?
      cols = dl.split(',')
      freq = get_freq(cols[2])
      date = grok_date(cols[1], cols[2])
      data_hash[freq] ||= {}
      data_hash[freq][date] = cols[3].to_f
    end
    data_hash
  end
  
  def data
    @data_hash ||= get_data
  end

  def download(verifyssl: true)
    begin
      @content = get_by_http(verifyssl: verifyssl)
    rescue => e
      Rails.logger.warn { "API http download failure, backing off to curl, url=#{self.url} [error: #{e.message}]" }
      @content = %x{curl --insecure --globoff '#{self.url}' 2>/dev/null}  ### assumes that get_by_http failed because of SSL/TLS problem
      unless $?.success?
        msg = $?.to_s.sub(/pid \d+\s*/, '')  ## delete pid number, so error messages will not be all distinct, for reporting
        raise "curl command failed: #{msg}"
      end
    end
    Nokogiri::HTML(@content)
  end

private

  def get_freq(other_string)
    return 'A' if other_string == 'M13'
    return 'M' if other_string[0] == 'M'
    return 'S' if other_string[0] == 'S'
    'Q' if other_string[0] == 'Q'
  end

  def estatjp_filter_match(filters, dp)
    filters.keys.each do |key|
      dp_key = '@' + key.to_s
      return false if dp[dp_key] != filters[key].to_s
    end
    true
  end

  def get_by_http(verifyssl: true)
    require 'uri'
    require 'net/http'
    require 'timeout'

    url = URI(@url)
    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = url.scheme == 'https'
    unless verifyssl  ## can be used for temporary workaround when sites have SSL cert trouble
      Rails.logger.warn { "Not verifying SSL certs for #{url}" }
      http.verify_mode = OpenSSL::SSL::VERIFY_NONE
    end
    http.ssl_timeout = 60
    if @post_parameters.nil? || @post_parameters.length == 0
      return fetch(@url).read_body
    end
    request = Net::HTTP::Post.new(url)
    request['cache-control'] = 'no-cache'
    request['content-type'] = 'application/x-www-form-urlencoded'
    request.body = URI::encode_www_form @post_parameters
    http.request(request).read_body
  end

  def fetch(uri_str, limit = 10)
    raise ArgumentError, 'too many HTTP redirects' if limit == 0

    Rails.logger.debug { "GETTING URL #{URI(uri_str)}" }
    response = Net::HTTP.get_response(URI(uri_str))

    case response
      when Net::HTTPSuccess then
        response
      when Net::HTTPRedirection then
        location = response['location']
        Rails.logger.warn { "redirected to #{location}" }
        fetch(location, limit - 1)                         ### RECURSION
      else
        response.value
    end
  end
  
end
