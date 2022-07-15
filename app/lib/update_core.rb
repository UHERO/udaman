module UpdateCore
  include HelperUtilities

  def load_error?
    @load_error ||= false
  end
  
  def header_location
    @header_location ||= determine_header_location
  end
  
  def headers
    @headers ||= read_headers
  end

  def headers_with_frequency_code
    return self.headers.keys if self.headers.keys[0].split('.').count == 2
    return_array = Array.new
    frequency_code = ''
    frequency_code = '.A' if self.frequency == :year
    frequency_code = '.M' if self.frequency == :month
    frequency_code = '.Q' if self.frequency == :quarter
    frequency_code = '.S' if self.frequency == :semi
    frequency_code = '.W' if self.frequency == :week
    
    arr = self.headers.sort {|a,b| a[1]<=>b[1]}
    arr.each do |elem|
      header_name = elem[0]
      return_array.push(header_name + frequency_code) unless header_name.nil?
    end
    return_array
  end
  
  def frequency
    @frequency ||= date_frequency
  end
  
  def dates
    @dates ||= read_dates
  end
  
  def date_interval(a = 0, b = 1)
    sorted_dates = self.dates.keys.sort
    raise 'There seems to be no data' if sorted_dates.empty?
    (sorted_dates[b].to_date - sorted_dates[a].to_date).to_i
  end
  
  def date_frequency
    case date_interval
      when (365..366) then :year
      when (168..183) then :semi
      when (84..93) then :quarter
      when (28..31) then :month
      when 7 then :week
      when 1 then :day
      else raise("Cannot compute frequency: date interval of #{date_interval} days")
    end
  end
  
  def metadata_header(cell_data)
    return false unless cell_data.class == String
    metadata_headers = ['LineCode','LineTitle','Industry Code','Industry','Definitions', 'UNIT', 'Year Month', 'Value']
    metadata_headers.include?(cell_data)
  end

  def cell_to_date(row,col)
    cell_data = cell(row,col)
    cell_data = Float cell_data rescue cell_data
    return nil if cell_data.nil? or metadata_header(cell_data)

    if cell_data.class == Float
      return Date.parse cell_data.to_s.split('.')[0]+'-01-01' if cell_data < 2100 and cell_data > 1900 and cell_data.to_s.split('.')[1] == 0
      return Date.parse cell_data.to_s[0..3]+'-'+cell_data.to_s[4..5]+'-01' if cell_data > 9999
      
      quarter_info = (cell_data - cell_data.to_i).round 1
      return Date.parse "Jan #{cell_data.to_i}" if quarter_info == 0 or quarter_info == 0.1
      return Date.parse "Apr #{cell_data.to_i}" if quarter_info == 0.2 
      return Date.parse "Jul #{cell_data.to_i}" if quarter_info == 0.3
      return Date.parse "Oct #{cell_data.to_i}" if quarter_info == 0.4
    end
    
    if cell_data.is_a? String and cell_data.match(/^S\d\d/) 
      semi_date = cell_data.split(' ')[0] == 'S01' ? '-01-01' : '-07-01'
      return Date.parse cell_data.split(' ')[1] + semi_date
    end

    ## If it's a quarter spec (YYYYQ2, etc) then convert to a date (else don't)
    cell_data = qspec_to_date(cell_data) || cell_data

    Date.parse cell_data.to_s
  end
  
  #this needs to be speced and tested      
  def convert_if_quarters(dates)
    quarter_dates = {}
    dates.each do |date,index|
      middle = date.month
      return dates if middle > 4
      quarter_dates[Date.new(date.year, (middle * 3) - 2)] = index
    end
    quarter_dates
  end
  
  def series(series_name)
    series_name.upcase!
    if series_name.split('.').count > headers.keys[0].split('.').count
      series_name = series_name.split('.')[0]
    end
    series_hash = Hash.new
    
    if header_location == 'columns'
      col = headers[series_name] || raise("Cannot find series name #{series_name} in a column")
      dates.each do |date, row|
        row = Integer(row) rescue raise("Illegal row coordinate=#{row || 'nil'}: expecting integer")
        value = self.cell(row, col)
        series_hash[date] = value.blank? ? nil : value
      end
    elsif header_location == 'rows'
      row = headers[series_name] || raise("Cannot find series name #{series_name} in a row")
      dates.each do |date, col|
        col = Integer(col) rescue raise("Illegal column coordinate=#{col || 'nil'}: expecting integer")
        value = self.cell(row, col)
        series_hash[date] = value.blank? ? nil : value
      end
    else
      raise "Unknown header location=#{header_location}: was expecting 'rows' or 'columns'"
    end
    series_hash
  end
      
  def read_dates
    @dates = Hash.new

    if self.header_location == 'columns'
      2.upto(self.last_row) do |row|
        # date_string = self.cell(row,1).to_s
        # date = Date.parse date_string
        date = self.cell_to_date(row,1)
        @dates[date] = row unless date.nil?
      end
    end

    if self.header_location == 'rows'
      2.upto(self.last_column) do |col|
        date = self.cell_to_date(1,col)
        @dates[date] = col unless date.nil?
      end
    end
    @dates = convert_if_quarters @dates 
  end
    
  def read_headers
    @headers = Hash.new

    if self.header_location == 'columns'
      2.upto(self.last_column) do |col|
        cell = self.cell(1, col)
        header_string = cell && cell.upcase
        @headers[header_string] = col unless header_string.nil? or header_string.is_a?(Numeric) or header_string['@'] != '@'
      end
    end
    
    if self.header_location == 'rows'
      2.upto(self.last_row) do |row|
        cell = self.cell(row, 1)
        header_string = cell && cell.upcase
        @headers[header_string] = row unless header_string.nil? or header_string.is_a?(Numeric) or header_string['@'] != '@'
      end
    end
    
    @headers
  end
  
  def determine_header_location
    case
      when columns_have_series? then 'columns'
      when rows_have_series? then 'rows'
      else raise 'Unable to determine series header location'
    end
  end
  
  def update_formatted?
    return true if columns_have_series? && rows_have_dates?
    return true if columns_have_dates? && rows_have_series?
    false
  end
  
  def columns_have_series?
    2.upto(self.last_column) do |col|
      header_string = self.cell(1,col)
      next if header_string == 'Year Month' #applies to CSV only
      return false unless header_string.nil? or header_string.class != String or header_string['@'] == '@'
    end
    true
  end
  
  def rows_have_series?
    2.upto(self.last_row) do |row|
      header_string = self.cell(row,1)
      return false unless header_string.nil? or header_string.class != String or header_string['@'] == '@'
    end
    true
  end
  
  def rows_have_dates?
    2.upto(self.last_row) do |row|
      begin
        cell_to_date(row,1)
      rescue ArgumentError
        #puts "returning false for row #{row}"
        return false
      rescue TypeError
        puts 'rows_have_dates? -> TypeError'
      end
    end
    true
  end
  
  def columns_have_dates?
    2.upto(self.last_column) do |col|
      begin
        cell_to_date(1,col)
      rescue ArgumentError
        return false 
      rescue TypeError
        puts 'rows_have_dates? -> TypeError'
      end
      return true
    end
  end
end
