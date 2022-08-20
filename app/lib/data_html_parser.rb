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
    data = {}
    doc.css('observation').each do |obs|
      data[obs[:date]] = obs[:value].to_f unless obs[:value] == '.'
    end
    data
  end
  
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
      raise 'BEA API Error: %s%s (code=%s)' % [err['APIErrorDescription'], err['AdditionalDetail'], err['APIErrorCode']]
    end
    results_data = beaapi['Results']['Data']
    raise 'BEA API: results, but no data' unless results_data

    new_data = {}
    results_data.each do |data_point|
      next unless request_match(filters, data_point)
      time_period = data_point['TimePeriod']
      value = data_point['DataValue']
      if value && value.gsub(',','').is_numeric?
        new_data[ get_date(time_period[0..3], time_period[4..-1]) ] = value.gsub(',','').to_f
      end
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
      time_period = estatjp_convert_date(data_point['@time']) || next
      value = data_point['$']  ## apparently all values are money, even when they're not ;)
      if value && value.gsub(',','').is_numeric?
        new_data[time_period] = value.gsub(',','').to_f
      end
    end
    new_data
  end

  def get_clustermapping_series(dataset, parameters)
    parameters[2] = expand_date_range(parameters[2]) if parameters[2].include? ':'
    query_params = parameters.map(&:to_s).join('/')
    @url = "https://clustermapping.us/data/region/#{query_params}"
    Rails.logger.debug { "Getting data from Clustermapping API: #{@url}" }
    @doc = self.download
    raise 'Clustermapping API: empty response returned' if self.content.blank?
    response = JSON.parse(self.content) rescue raise('Clustermapping API: JSON parse failure')
    new_data = {}
    response.each do |data_point|
      time_period = data_point['year_t']
      value = data_point[dataset]
      if value
        new_data[ get_date(time_period[0..3], time_period[4..-1]) ] = value
      end
    end
    new_data
  end

  def expand_date_range(date_range)
    split_dates = date_range.split(":")
    (split_dates[0]..split_dates[1]).to_a.join(',')
  end

  def get_eia_series(parameter)
    api_key = ENV['API_KEY_EIA'] || raise('No API key defined for EIA')
    @url = "https://api.eia.gov/series/?series_id=#{parameter}&api_key=#{api_key}"
    Rails.logger.info { "Getting data from EIA API: #{@url}" }
    @doc = self.download
    raise 'EIA API: empty response returned' if self.content.blank?
    response = JSON.parse(self.content) rescue raise('EIA API: JSON parse failure')
    err = response['data'] && response['data']['error']
    if err
      raise 'EIA API error: %s' % response['data']['error']
    end
    new_data = {}
    series_data = response['series'][0]['data']
    series_data.each do |data_point|
      time_period = data_point[0]
      value = data_point[1]
      if value
        new_data[ get_date(time_period[0..3], time_period[4..-1]) ] = value
      end
    end
    new_data
  end

  def get_dvw_series(mod, freq, indicator, dimension_hash)
    ##api_key = ENV['API_KEY_DVW'] || raise('No API key defined for DVW')
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
      date = get_date(cols[1], cols[2])
      data_hash[freq] ||= {}
      data_hash[freq][date] = cols[3].to_f
    end
    data_hash
  end
  
  def data
    @data_hash ||= get_data
  end
  
  def get_freq(other_string)
    return 'A' if other_string == 'M13'
    return 'M' if other_string[0] == 'M'
    return 'S' if other_string[0] == 'S'
    'Q' if other_string[0] == 'Q'
  end

  def get_date(year_string, other_string)
    month = case other_string
              when /^M(0[1-9]|1[0-2])\b/ then $1.to_i
              when /^(0[1-9]|1[0-2])\b/  then $1.to_i
              when /^(M13|S0?1)\b/       then 1
              when /^S0?2\b/             then 7
              when /^Q0?([1-4])\b/       then first_month_of_quarter($1)
              when ''                    then 1
              else raise('Error: invalid date %s-%s' % [year_string, other_string])
            end
    Date.new(year_string.to_i, month)
  end

  def estatjp_convert_date(datecode)
    year = datecode[0..3]
    m1 = datecode[-4..-3].to_i
    m2 = datecode[-2..-1].to_i
    return nil unless m1 == m2 && m2 > 0 && m2 <= 12
    '%s-%02d-01' % [year, m2]
  end

  def estatjp_filter_match(filters, dp)
    filters.keys.each do |key|
      dp_key = '@' + key.to_s
      return false if dp[dp_key] != filters[key].to_s
    end
    true
  end

  def download(verifyssl: true)
    begin
      @content = get_by_http(verifyssl: verifyssl)
    rescue => e
      Rails.logger.warn { "API http download failure, backing off to curl, url=#{self.url} [error: #{e.message}]" }
      @content = %x{curl --insecure '#{self.url}' 2>/dev/null}  ### assumes that get_by_http failed because of SSL/TLS problem
      unless $?.success?
        msg = $?.to_s.sub(/pid \d+\s*/, '')  ## delete pid number, so error messages will not be all distinct, for reporting
        raise "curl command failed: #{msg}"
      end
    end
    Nokogiri::HTML(@content)
  end

private

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
