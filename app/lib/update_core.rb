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
   # test that ordeer corresponds to col headings  
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
  
  def date_interval
    sorted_dates = self.dates.keys.sort
    date1 = Date.parse sorted_dates[0].to_s
    date2 = Date.parse sorted_dates[1].to_s
    (date2-date1).to_i
  end
  
  def date_frequency
    return :year if (365..366) === date_interval
    return :semi if (168..183) === date_interval
    return :quarter if (84..93) === date_interval
    return :month if (28..31) === date_interval
    :week if date_interval == 7
  end
  
  def metadata_header(cell_data)
    metadata_headers =  ['LineCode','LineTitle','Industry Code','Industry','Definitions', 'UNIT', 'Year Month', 'Value']
    return false unless cell_data.class == String
    true if metadata_headers.include?(cell_data)
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

    if cell_data =~ /([12]\d\d\d)[-. ]?Q0?([1234])/i  ## Quarter spec like YYYYQ1, YYYY-Q1, YYYY-Q01, "YYYY Q1", etc
      cell_data = '%s-%02d-01' % [$1, first_month_of_quarter($2)]
    end
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
  
  def nil_if_blank(value)
    if value.class == String and value.strip == ''
      nil
    else
      value
    end
  end
  def series(series_name)
    #puts "series name: " + series_name
    series_name = series_name.split('.')[0] if series_name.split('.').count > headers.keys[0].split('.').count
    series_hash = Hash.new
    
    if self.header_location == 'columns'
      col = headers[series_name]
      dates.each do |date,row|
        series_hash[date] = nil_if_blank(self.cell(row,col))
      end
    end
    
    if self.header_location == 'rows'
      row = headers[series_name]
      dates.each do |date,col|
        series_hash[date] = nil_if_blank(self.cell(row,col))
      end
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
        header_string = self.cell(1,col)
        @headers[header_string] = col unless header_string.nil? or header_string.nil? or header_string.is_a?(Numeric) or header_string['@'] != '@'
      end
    end
    
    if self.header_location == 'rows'
      2.upto(self.last_row) do |row|
        header_string = self.cell(row,1)
        @headers[header_string] = row unless header_string.nil? or header_string.nil? or header_string.is_a?(Numeric) or header_string['@'] != '@'
      end
    end
    
    @headers
  end
  
  def determine_header_location
    return 'columns' if columns_have_series? 
    'rows' if rows_have_series?
  end
  
  def update_formatted?
    # puts "columns have series: #{columns_have_series?}"
    # puts "rows have dates: #{rows_have_dates?}"
    # puts "rows have series: #{rows_have_series?}"
    # puts "columns have dates: #{columns_have_dates?}"
    return true if columns_have_series? and rows_have_dates?
    return true if columns_have_dates? and rows_have_series?
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
