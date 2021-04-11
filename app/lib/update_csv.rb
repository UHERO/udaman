require 'csv'

class UpdateCSV 
  include UpdateCore

  def initialize(csv_file, type: :file)
    if type == :text
      @data = parse_csv_text(csv_file)
    else
      @data = CSV.read(csv_file) rescue @load_error = true
      raise 'File does not exist?' unless @data.class == Array
    end
  end
  
  def cell(row, col)
    val = @data[row - 1][col - 1] rescue raise("No data at CSV file row position #{row}")
    val = val.gsub(',','') if val.class == String
    Float(val) rescue @data[row - 1][col - 1]
  end
  
  def last_column
    @data[0].count rescue raise('File appears to contain no data')
  end
  
  def last_row
    @data.count rescue raise('File appears to contain no data')
  end

  def rows_have_dates?
    true
  end
  
  def columns_have_dates?
    false
  end
  
  def read_dates
    @dates = Hash.new

    if self.header_location == 'columns'
      date_col = cell(1,2) == 'Year Month' ? 2 : 1
      2.upto(self.last_row) do |row|
        date = self.cell_to_date(row,date_col)
        @dates[date.to_formatted_s] = row unless date.nil?
      end
    end
    
    @dates
  end

private

  def parse_csv_text(text, delim: ',', prune: true, nil_empties: false)
    data = []
    file = StringIO.new(text)
    loop do
      line = file.gets || break
      row = line.split(delim).map(&:strip)
      next if prune && (row.empty? || row.count == 1 && row[0] == '')
      row = row.map {|x| x.nil_blank } if nil_empties
      data.push row
    end
    data
  end
end
