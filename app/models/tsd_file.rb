class TsdFile < ActiveRecord::Base
  include Cleaning
  require 'digest/md5'
  require 'date'
  belongs_to :forecast_snapshot
  before_destroy :delete_from_disk

  def TsdFile.path_prefix
    'tsd_files'
  end

  def path
    File.join(ENV['DATA_PATH'], tsd_rel_filepath(self.filename))
  end

  def store_tsd(file_content)
    begin
      self.save or raise StandardError, 'TSD object save failed'
      write_to_disk(file_content) or raise StandardError, 'TSD file disk write failed'
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def retrieve_content
    read_from_disk
  end

  def read_tsd_block
    open_tsd
    read_next_line
    yield self
    close_tsd
  end

  def get_next_series
    raise  "You're not at the right position in the file" unless @last_line_type == :name_line
    series_hash = get_name_line_attributes
    read_next_line
    series_hash.merge!(get_second_line_attributes)
    series_hash[:udaman_series] = Series.find_by(name: series_hash[:name] + '.' + series_hash[:frequency])
    read_next_line
    series_hash[:data] = get_data
    series_hash[:data_hash] = parse_data(series_hash[:data], series_hash[:start], series_hash[:frequency])
    series_hash[:yoy_hash] = yoy(series_hash[:data_hash])
    series_hash
  end

  def get_number
    get_names.count
  end

  def get_names
    name_array = []
    read_tsd_block_no_first_line do |tsd|
      begin
        last_line_type = tsd.read_next_line
        name_array.push(get_name_line_attributes[:name]) if last_line_type == :name_line
      end until last_line_type.nil?
    end
    name_array
  end

  def get_current_plus_five_dates
    dates = get_all_dates
    future = dates.index{|date| date > Date.today.to_s }
    unless future
      return dates
    end
    dates.slice(future - 2, 6)
  end

  def get_all_dates
    dates = []
    get_all_series.each do |s|
      dates += s[:data_hash].keys
    end
    dates.sort.uniq
  end

  def get_all_series
    series = []
    read_tsd_block do |tsd|
      begin
        series.push(tsd.get_next_series) if @last_line_type == :name_line
      end until @last_line.nil?
    end
    series
  end

  def search_names(name)
    read_tsd_block_no_first_line do |tsd|
      begin
        last_line_type = tsd.read_next_line
        return tsd.get_next_series if last_line_type == :name_line and get_name_line_attributes[:name] == name
      end until last_line_type.nil?
    end
    nil
  end

  def parse_data(data, start_date_string, frequency)
    return parse_annual_data(data, start_date_string) if frequency == 'A'
    return parse_semi_annual_data(data, start_date_string) if frequency == 'S'
    return parse_quarterly_data(data, start_date_string) if frequency == 'Q'
    return parse_monthly_data(data, start_date_string) if frequency == 'M'
    return parse_weekly_data(data, start_date_string) if frequency == 'W'
    parse_daily_data(data, start_date_string) if frequency == 'D'
  end

  def parse_date(aremos_date_string, frequency, a_date_type, daily_switches)
    if frequency == 'W'
      listed_date = Date.parse(aremos_date_string)
      date = listed_date+daily_switches.index('1')
      #puts '#{daily_switches} | #{aremos_date_string} | #{Date.parse(aremos_date_string).wday} | #{date}' 
      return date.to_s
    end
    year = aremos_date_string[0..3]
    month = aremos_date_string[4..5]
    if frequency == 'Q'
      month_int = month.to_i * 3 - 2
      month = month_int < 10 ? "0#{month_int}" : "#{month_int}"
    end
    day = aremos_date_string[6..7]
    day = '01' if day == '00'
    "#{year}-#{month}-#{day}"
  end

  protected
  def read_tsd_block_no_first_line
    open_tsd
    yield self
    close_tsd
  end

  def check_error(line, type)
    raise "You haven't read a line yet!" if @last_line.nil?
    raise "You're attempting to parse the wrong type of line!" if line != type
  end

  def read_next_line
    @last_line = @file.gets
    return nil if @last_line.nil?
    @last_line_type = :data_line if @last_line.index('.')
    @last_line_type = :name_line if @last_line.index('@')
    @last_line_type = :details_line if @name_line
    @name_line = false
    @last_line_type
  end

  def get_name_line_attributes
    check_error(@last_line_type, :name_line)
    @name_line = true
    { :name => @last_line[0..15].strip, :description => @last_line[16..-1].strip }
  end

  def get_second_line_attributes
    check_error(@last_line_type, :details_line)
    update = Date.strptime @last_line[32..39].gsub(/ /, ''), '%m/%d/%y'
    { :update=> update, :start => @last_line[44..51], :end => @last_line[52..59], :frequency => @last_line[60..60], :daily_switches => @last_line[73..79] }
  end

  def get_data_line
    check_error(@last_line_type, :data_line)
    read_data(@last_line)
  end
  # 
  def get_data
    check_error(@last_line_type, :data_line)
    @data_array = []
    while @last_line_type == :data_line and !@last_line.nil?
      @data_array += read_data(@last_line) unless @last_line.nil?
      read_next_line
    end
    @data_array
  end

  def open_tsd
    @file = File.open(path, 'r')
  end

  def read_data(line)
    line.scan(/.{15}/)
  end

  def close_tsd
    @file.close
  end

  def parse_annual_data(data, start_date_string)
    data_hash = {}
    year = start_date_string[0..3].to_i
    data.each do |datapoint|
      return data_hash if datapoint.strip == ''
      data_hash["#{year}-01-01"] = datapoint.to_f
      year += 1
    end
    data_hash
  end


  def parse_semi_annual_data(data, start_date_string)
    data_hash = {}
    year = start_date_string[0..3].to_i
    semi = start_date_string[4..5].to_i
    semi_array = %w(01 07)
    data.each do |datapoint|
      return data_hash if datapoint.strip == ''
      data_hash["#{year}-#{semi_array[semi-1]}-01"] = datapoint.to_f
      semi += 1
      if semi > 2
        semi = 1
        year += 1
      end
    end
    data_hash
  end

  def parse_quarterly_data(data, start_date_string)
    data_hash = {}
    year = start_date_string[0..3].to_i
    quarter = start_date_string[4..5].to_i
    quarter_array = %w(01 04 07 10)
    data.each do |datapoint|
      return data_hash if datapoint.strip == ''
      data_hash["#{year}-#{quarter_array[quarter-1]}-01"] = datapoint.to_f
      quarter += 1
      if quarter > 4
        quarter = 1
        year += 1
      end
    end
    data_hash
  end

  def parse_monthly_data(data, start_date_string)
    data_hash = {}
    year = start_date_string[0..3].to_i
    month = start_date_string[4..5].to_i
    data.each do |datapoint|
      return data_hash if datapoint.strip == ''
      month_filler = month < 10 ? '0' : ''
      data_hash["#{year}-#{month_filler}#{month}-01"] = datapoint.to_f
      month += 1
      if month > 12
        month = 1
        year += 1
      end
    end
    data_hash
  end

  def parse_weekly_data(data, start_date_string)
    data_hash = {}
    date = Date.parse start_date_string
    data.each do |datapoint|
      return data_hash if datapoint.strip == ''
      data_hash[date.to_s] = datapoint.to_f
      date += 7
    end
    data_hash
  end

  def parse_daily_data(data, start_date_string)
    data_hash = {}
    date = Date.parse start_date_string
    data.each do |datapoint|
      return data_hash if datapoint.strip == ''
      data_hash[date.to_s] = datapoint.to_f
      date += 1
    end
    data_hash
  end

  def yoy(data)
    result = {}
    data.sort.each do |date, value|
      last_year_date = (Date.strptime(date, '%Y-%m-%d') - 1.year).strftime('%Y-%m-%d')
      result[date] = (value-data[last_year_date])/data[last_year_date]*100 unless data[last_year_date].nil?
    end
    result
  end

private
  def write_to_disk(content)
    begin
      File.open(path, 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
	  true
  end

  def read_from_disk
    begin
      content = File.open(path, 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      puts ">>>>>>> dEBUF path=#{path}"
      return false
    end 
    content
  end

  def delete_from_disk
    begin
      File.delete(path)
    rescue StandardError => e
      Rails.logger.error e.message
      return false  ## prevents destruction of the model object
    end
	  true
  end

  def tsd_rel_filepath(name)
    string = self.forecast_snapshot.created_at.to_s+'_'+self.forecast_snapshot_id.to_s+'_'+name
    hash = Digest::MD5.new << string
    File.join(TsdFile.path_prefix, hash.to_s+'_'+name)
  end
end
