class ForecastSnapshot < ActiveRecord::Base
  require 'digest/md5'
  require 'date'
  before_destroy :delete_files_from_disk

  def path(filename)
    File.join(ENV['DATA_PATH'], tsd_rel_filepath(filename))
  end

  def store_fs(newfile = nil, oldfile = nil, histfile = nil)
    new_tsd_content = newfile.read if newfile
    old_tsd_content = oldfile.read if oldfile
    hist_tsd_content = histfile.read if histfile
## validate file content
    begin
      self.save or raise StandardError, 'FS object save failed'
      if newfile
        write_file_to_disk(self.new_forecast_tsd_filename, new_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if oldfile
        write_file_to_disk(self.old_forecast_tsd_filename, old_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
      if histfile
        write_file_to_disk(self.history_tsd_filename, hist_tsd_content) or raise StandardError, 'TSD file disk write failed'
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def read_tsd_block
    open_tsd
    read_next_line
    yield self
    close_tsd
  end

  def get_next_series
    raise  "You're not at the right position in the file" unless @last_line_type == :name_line
    @series_hash = get_name_line_attributes
    read_next_line
    @series_hash.merge!(get_second_line_attributes)
    read_next_line
    @series_hash[:data] = get_data
    @series_hash
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
private
  def write_file_to_disk(name, content)
    begin
      File.open(path(name), 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def read_file_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    content
  end

  def delete_files_from_disk

    begin
      File.delete(path(self.new_forecast_tsd_filename)) if self.new_forecast_tsd_filename
      File.delete(path(self.old_forecast_tsd_filename)) if self.old_forecast_tsd_filename
      File.delete(path(self.history_tsd_filename)) if self.history_tsd_filename
    rescue StandardError => e
      Rails.logger.error e.message
      return false  ## prevents destruction of the model object
    end
    true
  end

  def tsd_rel_filepath(name)
    string = self.created_at.to_s+'_'+self.id.to_s+'_'+name
    hash = Digest::MD5.new << string
    File.join('tsd_files', hash.to_s+'_'+name)
    end
end
