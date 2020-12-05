require 'csv'

class UpdateCSV 
  include UpdateCore

  def initialize(spreadsheet_name)
    begin
      @data = CSV.read(spreadsheet_name)
    rescue
      @load_error = true
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
  
end
