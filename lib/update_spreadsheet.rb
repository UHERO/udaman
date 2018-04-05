require 'roo'

class UpdateSpreadsheet < Roo::Excel
  include UpdateCore
  
  def UpdateSpreadsheet.new_xls_or_csv(spreadsheet_name)
    name = spreadsheet_name.strip
    return UpdateCSV.new name if name[-3..-1] == 'csv'
    return UpdateSpreadsheet.new name
  end
  
  def initialize(spreadsheet_name)
    begin
      super spreadsheet_name
    rescue => e
      logger.error { "UpdateSpreadsheet.initialize error: #{e.message}" }
      @load_error = true
    end
  end
end
