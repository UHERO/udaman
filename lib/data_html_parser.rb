class DataHtmlParser

  def get_fred_series(code, frequency = nil, aggregation_method = nil)
    api_key = ENV['API_KEY_FRED']
    raise 'No API key defined for FRED' unless api_key
    @url = "http://api.stlouisfed.org/fred/series/observations?api_key=#{api_key}&series_id=#{code}"
    # frequencies: d, w, bw, m, q, sa, a (udaman represents semiannual frequency with S)
    @url += "&frequency=#{frequency.downcase.gsub(/^s$/, 'sa')}" unless frequency.nil?
    # avg, sum, eop
    @url += "&aggregation_method=#{aggregation_method.downcase}" unless aggregation_method.nil?
    @doc = self.download
    self.get_fred_data
  end
  
  def get_fred_data
    data_hash ||= {}
    @doc.css('observation').each do |obs|
      data_hash[obs[:date]]= obs[:value].to_f unless obs[:value] == '.'
    end
    data_hash
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
    @url = "http://www.bea.gov/api/data/?UserID=#{api_key}&method=GetData&datasetname=#{dataset}&#{query_pars}&ResultFormat=JSON&"
    Rails.logger.debug { "Getting URL from BEA API: #{@url}" }
    @doc = self.download
    new_data = {}
    bea_data = JSON.parse self.content
    bea_data['BEAAPI']['Results']['Data'].each do |data_point|
      next unless request_match(parameters, data_point)
      time_period = data_point['TimePeriod']
      value = data_point['DataValue']
      if value && value.gsub(',','').is_numeric?
        new_data[ get_date(time_period[0..3], time_period[4..-1]) ] = value.gsub(',','').to_f
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
    return Date.new(year_string.to_i) if other_string == 'M13'
    return Date.new(year_string.to_i, other_string[1..2].to_i) unless %w(M01 M02 M03 M04 M05 M06 M07 M08 M09 M10 M11 M12).index(other_string).nil?
    return Date.new(year_string.to_i) if other_string == 'S01'
    return Date.new(year_string.to_i, 7) if other_string == 'S02'
    return Date.new(year_string.to_i) unless %w(Q1 Q01).index(other_string).nil?
    return Date.new(year_string.to_i, 4) unless %w(Q2 Q02).index(other_string).nil?
    return Date.new(year_string.to_i, 7) unless %w(Q3 Q03).index(other_string).nil?
    return Date.new(year_string.to_i, 10) unless %w(Q4 Q04).index(other_string).nil?
    Date.new(year_string.to_i) if other_string == ''
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
