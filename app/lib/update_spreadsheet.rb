require 'roo'

class UpdateSpreadsheet < Roo::Excel
  include UpdateCore
  
  def UpdateSpreadsheet.new_xls_or_csv(spreadsheet_name)
    name = spreadsheet_name.strip
    name =~ /csv$/i ? UpdateCSV.new(name) : UpdateSpreadsheet.new(name)
  end
  
  def initialize(spreadsheet_name)
    begin
      super spreadsheet_name
    rescue => e
      Rails.logger.error { "UpdateSpreadsheet.initialize error: #{e.message}" }
      @load_error = true
    end
  end
end
