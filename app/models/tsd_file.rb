class TsdFile < ApplicationRecord
  include Cleaning
  require 'digest/md5'
  require 'date'
  belongs_to :forecast_snapshot
  before_destroy :delete_from_disk

  def path
    File.join(ENV['DATA_PATH'], tsd_rel_filepath(self.filename))
  end

  def assign_content(text)
    @string_content = StringIO.new(text)
    self
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

  def get_next_series(nils: false, data_only: false)  ## nils means to include nil values, corresponding to trailing blank strings
    raise 'You are not at the right position in the file' unless @last_line_type == :name_line
    series_hash = get_name_line_attributes
    read_next_line
    series_hash.merge! get_second_line_attributes
    series_hash[:udaman_series] = Series.build_name_two(series_hash[:name], series_hash[:frequency]).ts unless data_only
    read_next_line
    series_hash[:data] = get_data
    series_hash[:data_hash] = parse_data(series_hash[:data], series_hash[:start], series_hash[:frequency], nils: nils)
    series_hash[:yoy_hash] = yoy(series_hash[:data_hash]) unless data_only
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

  def get_all_dates(nils: false)  ## nils means to include nil values, corresponding to trailing blank strings
    @all_dates ||= _get_all_dates(nils: nils)
  end

  def _get_all_dates(nils: false)
    dates = []
    get_all_series(nils: nils).each do |s|
      dates |= s[:data_hash].keys
    end
    dates.sort
  end

  def get_all_series(nils: false)  ## nils means to include nil values, corresponding to trailing blank strings
    @all_series ||= _get_all_series(nils: nils)
  end

  def _get_all_series(nils: false)
    series = []
    read_tsd_block do |tsd|
      begin
        if @last_line_type == :name_line
          series.push tsd.get_next_series(nils: nils)
        end
      end until @last_line.nil?
    end
    series
  end

  def get_series(name, nils: false, data_only: false)
    read_tsd_block do |tsd|
      begin
        if @last_line_type == :name_line
          s = tsd.get_next_series(nils: nils, data_only: data_only)
          return s if s[:name] == name
        end
      end until @last_line.nil?
    end
    nil
  end

  def parse_data(data, start_date_string, frequency, nils: false)
    return parse_annual_data(data, start_date_string, nils: nils) if frequency == 'A'
    return parse_semi_annual_data(data, start_date_string, nils: nils) if frequency == 'S'
    return parse_quarterly_data(data, start_date_string, nils: nils) if frequency == 'Q'
    return parse_monthly_data(data, start_date_string, nils: nils) if frequency == 'M'
    return parse_weekly_data(data, start_date_string, nils: nils) if frequency == 'W'
    return parse_daily_data(data, start_date_string, nils: nils) if frequency == 'D'
    raise "TSD parse_data: unknown frequency #{frequency}"
  end

  def parse_date(aremos_date_string, frequency, daily_switches)
    if frequency == 'W'
      listed_date = Date.parse(aremos_date_string)
      date = listed_date+daily_switches.index('1')
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
    while @last_line && @last_line_type == :data_line
      @data_array += read_data(@last_line)
      read_next_line
    end
    @data_array
  end

  def open_tsd
    @file = @string_content || File.open(path, 'r')
  end

  def read_data(line)
    line.scan(/.{15}/)
  end

  def close_tsd
    @file.close
  end

  def parse_annual_data(data, start_date_string, nils: false)
    data_hash = {}
    year = start_date_string[0..3].to_i
    data.each do |datapoint|
      value = Float(datapoint) rescue nil
      break if value.nil? && !nils
      data_hash["#{year}-01-01"] = value
      year += 1
    end
    data_hash
  end


  def parse_semi_annual_data(data, start_date_string, nils: false)
    data_hash = {}
    year = start_date_string[0..3].to_i
    semi = start_date_string[4..5].to_i
    semi_array = %w(01 07)
    data.each do |datapoint|
      value = Float(datapoint) rescue nil
      break if value.nil? && !nils
      data_hash["#{year}-#{semi_array[semi-1]}-01"] = value
      semi += 1
      if semi > 2
        semi = 1
        year += 1
      end
    end
    data_hash
  end

  def parse_quarterly_data(data, start_date_string, nils: false)
    data_hash = {}
    year = start_date_string[0..3].to_i
    quarter = start_date_string[4..5].to_i
    quarter_array = %w(01 04 07 10)
    data.each do |datapoint|
      value = Float(datapoint) rescue nil
      break if value.nil? && !nils
      data_hash["#{year}-#{quarter_array[quarter-1]}-01"] = value
      quarter += 1
      if quarter > 4
        quarter = 1
        year += 1
      end
    end
    data_hash
  end

  def parse_monthly_data(data, start_date_string, nils: false)
    data_hash = {}
    year = start_date_string[0..3].to_i
    month = start_date_string[4..5].to_i
    data.each do |datapoint|
      value = Float(datapoint) rescue nil
      break if value.nil? && !nils
      month_filler = month < 10 ? '0' : ''
      data_hash["#{year}-#{month_filler}#{month}-01"] = value
      month += 1
      if month > 12
        month = 1
        year += 1
      end
    end
    data_hash
  end

  def parse_weekly_data(data, start_date_string, nils: false)
    data_hash = {}
    date = Date.parse start_date_string
    data.each do |datapoint|
      value = Float(datapoint) rescue nil
      break if value.nil? && !nils
      data_hash[date.to_s] = value
      date += 7
    end
    data_hash
  end

  def parse_daily_data(data, start_date_string, nils: false)
    data_hash = {}
    date = Date.parse start_date_string
    data.each do |datapoint|
      value = Float(datapoint) rescue nil
      break if value.nil? && !nils
      data_hash[date.to_s] = value
      date += 1
    end
    data_hash
  end

  def yoy(data)
    result = {}
    data.sort.each do |date, value|
      last_year_date = (Date.strptime(date, '%Y-%m-%d') - 1.year).strftime('%Y-%m-%d')
      result[date] = (value - data[last_year_date]) / data[last_year_date] * 100 if value && data[last_year_date]
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
      return false
    end 
    content
  end

  def delete_from_disk
    begin
      File.delete(path)
    rescue StandardError => e
      Rails.logger.error e.message
      throw(:abort)  ## prevents destruction of the model object
    end
	  true
  end

  def tsd_rel_filepath(name)
    forecast_snapshot.tsd_rel_filepath(name)
  end
end
