class DataHtmlParser

  def get_fred_series(code, frequency = nil, aggregation_method = nil)
    api_key = ENV['API_KEY_FRED']
    raise 'No API key defined for FRED' unless api_key
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
    frequency = self.data.keys[0] if frequency.nil?
    self.data[frequency]
  end

  # working Y@HI.A query
  # http://www.bea.gov/api/data/?&UserID=66533E32-0B70-4EF6-B367-05662C3B7CA8&method=GetData&datasetname=RegionalData&KeyCode=TPI_SI&GeoFIPS=15000&ResultFormat=JSON&
  # NIPA Test
  # http://www.bea.gov/api/data/?&UserID=66533E32-0B70-4EF6-B367-05662C3B7CA8&method=GetData&datasetname=NIPA&TableID=6&Frequency=A&Year=X&GeoFIPS=15001&ResultFormat=JSON&
  def get_bea_series(dataset, parameters)
    api_key = ENV['API_KEY_BEA']
    raise 'No API key defined for BEA' unless api_key
    query_pars = parameters.map{|k, v| "#{k}=#{v}"}.join('&')
    @url = "https://apps.bea.gov/api/data/?UserID=#{api_key}&method=GetData&datasetname=#{dataset}&#{query_pars}&ResultFormat=JSON&"
    Rails.logger.debug { "Getting URL from BEA API: #{@url}" }
    @doc = self.download
    response = JSON.parse self.content
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
      next unless request_match(parameters, data_point)
      time_period = data_point['TimePeriod']
      value = data_point['DataValue']
      if value && value.gsub(',','').is_numeric?
        new_data[ get_date(time_period[0..3], time_period[4..-1]) ] = value.gsub(',','').to_f
      end
    end
    new_data
  end

  def get_estatjp_series
    api_key = ENV['API_KEY_ESTATJP']
    api_key
  end

  def get_clustermapping_series(dataset, parameters)
    query_params = parameters.map(&:to_s).join('/')
    @url = "http://clustermapping.us/data/region/#{query_params}"
    Rails.logger.info { "Getting data from Clustermapping API: #{@url}" }
    @doc = self.download
    response = JSON.parse self.content
    raise  'Clustermapping API: unknown failure' unless response
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

  def get_eia_series(parameter)
    api_key = ENV['API_KEY_EIA']
    raise 'No API key defined for EIA' unless api_key
    @url = "https://api.eia.gov/series/?series_id=#{parameter}&api_key=#{api_key}"
    Rails.logger.info { "Getting data from EIA API: #{@url}" }
    @doc = self.download
    response = JSON.parse self.content
    raise 'EIA API: unknown failure' unless response
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
  
  def save_content(save_path)
    open(save_path, 'wb') { |file| file.write @content }
  end
  
  def bls_text
    #puts @doc.css('pre').text
    @doc.css('pre').text
  end
  
  def get_data
    @data_hash ||= {}
    data_lines = bls_text.split("\n")
    data_lines.each do |dl|
      next unless (dl.index @code) == 0
      cols = dl.split(',')
      freq = get_freq(cols[2])
      date = get_date(cols[1], cols[2])
      @data_hash[freq] ||= {}
      @data_hash[freq][date] = cols[3].to_f unless date.nil?
    end
    @data_hash
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
    case other_string
    # Monthly observations
    when /^((M0[1-9])|(M1[0-2]))\b/
      Date.new(year_string.to_i, other_string[1..2].to_i)
    when /^((0[1-9])|(1[0-2]))\b/
      Date.new(year_string.to_i, other_string.to_i)
    # Observations that should evaluate to January of year_string (including other_string === '')
    when /^$|^((M13)|(Q|S)(1|01))\b/
      Date.new(year_string.to_i)
    # (Quarterly) Observations that should evaluate to April of year_string
    when /^Q(2|02)\b/
      Date.new(year_string.to_i, 4)
    # (Quarterly/Semi-Annual) Observations that should evaluate to July of year_string
    when /^(S02|Q(3|03))\b/
      Date.new(year_string.to_i, 7)
    # (Quarterly) Observations that should evaluate to October of year_string
    when /^Q(4|04)\b/
      Date.new(year_string.to_i, 10)
    else
     'Error: invalid date %s-%s' % [year_string, other_string]
    end
  end
  
  def download
    require 'uri'
    require 'net/http'
    require 'timeout'

    url = URI(@url)

    http = Net::HTTP.new(url.host, url.port)
    http.use_ssl = url.scheme == 'https'
    http.ssl_timeout = 60
    if @post_parameters.nil? or @post_parameters.length == 0
      @content = fetch(@url).read_body
    else
      request = Net::HTTP::Post.new(url)
      request['cache-control'] = 'no-cache'
      request['content-type'] = 'application/x-www-form-urlencoded'
      request.body = URI::encode_www_form @post_parameters
      @content = http.request(request).read_body
    end
    Nokogiri::HTML(@content)
  end

  def fetch(uri_str, limit = 10)
    raise ArgumentError, 'too many HTTP redirects' if limit == 0

    response = Net::HTTP.get_response(URI(uri_str))

    case response
      when Net::HTTPSuccess then
        response
      when Net::HTTPRedirection then
        location = response['location']
        warn "redirected to #{location}"
        fetch(location, limit - 1)
      else
        response.value
    end
  end
  
end
