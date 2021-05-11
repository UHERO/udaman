
def code_from_frequency(frequency)
    return 'A' if frequency == :year || frequency == 'year' || frequency == :annual || frequency == 'annual' || frequency == 'annualy'
    return 'Q' if frequency == :quarter || frequency == 'quarter' || frequency == 'quarterly'
    return 'M' if frequency == :month || frequency == 'month' || frequency == 'monthly'
    return 'S' if frequency == :semi || frequency == 'semi' || frequency == 'semi-annually'
    ''
  end


def data_hash_string(update_spreadsheet_path, sheet_to_load = nil, sa = false)
  dh_string = ''
  update_spreadsheet = UpdateSpreadsheet.new_xls_or_csv(update_spreadsheet_path)
  if update_spreadsheet.load_error?
    return {:message => 'The spreadsheet could not be found', :headers => []}
  end

  default_sheet = sa ? 'Demetra_Results_fa' : update_spreadsheet.sheets.first unless update_spreadsheet.class == UpdateCSV
  update_spreadsheet.default_sheet = sheet_to_load.nil? ? default_sheet : sheet_to_load unless update_spreadsheet.class == UpdateCSV
  unless update_spreadsheet.update_formatted?
    return {:message=> 'The spreadsheet was not formatted properly', :headers=>[]}
  end

  update_spreadsheet_headers = sa ? update_spreadsheet.headers.keys : update_spreadsheet.headers_with_frequency_code 
  update_spreadsheet_headers.each do |series_name|
    
    frequency_code = code_from_frequency update_spreadsheet.frequency  
    base_name = sa ? series_name.sub('NS@','@') : series_name
    series_name = base_name+'.'+frequency_code if sa
    all_data = ''
    update_spreadsheet.series(series_name).each do |date_string, value|
      all_data += %Q|"#{date_string}" => #{value},| unless value.nil? or value.to_s == '' or value.to_s == ' '
      all_data += %Q|"#{date_string}" => nil,| if value.nil? or value.to_s == '' or value.to_s == ' '
    end
    all_data.chop!
    dh_string += %Q|"#{series_name}" => {#{all_data}}, |
    #{update_spreadsheet.series(series_name).to_s}|
  end
  dh_string
end
