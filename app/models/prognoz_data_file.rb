class PrognozDataFile < ActiveRecord::Base
  serialize :series_loaded, Hash
  
  def PrognozDataFile.send_prognoz_update(recipients = %w(jrpage@hawaii.edu vward@hawaii.edu))
    folder = "#{ENV['DATA_PATH']}/prognoz_export/"
    filenames = %w(Agriculture.xls CAFRCounties.xls Kauai.xls metatable_isdi.xls SourceDoc.xls TableTemplate.xls)
    filenames.map! {|elem| folder+elem}
    
    send_edition = Time.now.strftime('%yM%mD%d_%H%M%S')
    
    
    retired_path = "#{ENV['DATA_PATH']}/prognoz_export/exports/retired_official_versions/" + send_edition
    Dir.mkdir(retired_path) unless File.directory?(retired_path)
    
    self.all.each do |pdf| 
      puts pdf.safe_filename
      updated_file = pdf.safe_filename.gsub('/prognoz_export/', '/prognoz_export/exports/')
      original_file = pdf.safe_filename
      FileUtils.mv(original_file, retired_path + '/' + pdf.safe_filename.split('/')[-1])
      # this copy puts the new file in the right location to get zipped
      FileUtils.cp(updated_file, original_file)
      filenames.push pdf.safe_filename
    end
    
    Zip::File.open(folder + 'ready_to_send_zip_files/' + send_edition + '.zip', Zip::File::CREATE) do |zipfile|
      filenames.each {|fname| zipfile.add(fname.split('/')[-1], fname)}
    end
    
    PackagerMailer.prognoz_notification(recipients, send_edition).deliver
  end
  
  def update_spreadsheet
    UpdateSpreadsheet.new safe_filename
  end
  
  def load
    @output_spreadsheet = UpdateSpreadsheet.new safe_filename
    if @output_spreadsheet.load_error?
      return {:notice=> 'problem loading spreadsheet', :headers=>[]}
    end
    @output_spreadsheet.default_sheet = @output_spreadsheet.sheets.first

    self.frequency = @output_spreadsheet.frequency
    self.output_start_date = @output_spreadsheet.dates.keys.sort[0]
    # self.series_loaded ||= {}
    # @output_spreadsheet.headers_with_frequency_code.each do |series|
    #   self.series_loaded[series] = @output_spreadsheet.series series.split(".")[0] 
    # end
    self.save

    {:notice=> 'success', :headers => @output_spreadsheet.headers_with_frequency_code, :frequency => @output_spreadsheet.frequency}
  end

  def udaman_diffs
    t = Time.now
    os = UpdateSpreadsheet.new safe_filename
#    puts "#{"%.2f" %(Time.now - t)} | loading spreadsheet"
    if os.load_error?
      return {:notice => 'problem loading spreadsheet', :headers=>[]}
    end
    diffs = {}
    os.headers_with_frequency_code.each do |header|
#      t = Time.now
      if header.ts.nil?
        diffs[header] = nil
        next
      end
#      puts "#{"%.2f" %(Time.now - t)} | looking up #{header}"
#      t = Time.now
      diff_hash = header.ts.data_diff(os.series(header.split('.')[0]), 3)
#      puts "#{"%.2f" %(Time.now - t)} | data_diff for #{header}"
#      t = Time.now
      diffs[header] = diff_hash if diff_hash.count > 0
#      puts "#{"%.2f" %(Time.now - t)} | #{ filename}"
    end
    puts "#{'%.2f' %(Time.now - t)} | #{ safe_filename}"
    diffs
  end
    
  def get_data_for(series_name, output_spreadsheet = nil)    
    output_spreadsheet = UpdateSpreadsheet.new safe_filename if output_spreadsheet.nil?
    s = parse_series_name series_name
    unless s[:frequency_code] == Series.code_from_frequency(self.frequency)
      raise PrognozDataFindException
    end
    unless series_loaded.include? series_name
      raise PrognozDataFindException
    end
    unless output_spreadsheet.headers.include? s[:base_name]
      raise PrognozDataFindException
    end
    output_spreadsheet.series s[:base_name]
  end
    
  def output_path
    output_filename = filename.split('/')[-1]
    "#{ENV['DATA_PATH']}/prognoz_export/exports/" + output_filename
  end
  
  def safe_filename
    filename.gsub('/Users/uhero/Documents/data', ENV['DATA_PATH'])
  end
  
  def write_export
    t = Time.now
    os = update_spreadsheet    
    Series.write_prognoz_output_file(os.headers_with_frequency_code, output_path, os.sheets.first, os.dates.keys)
    puts "#{'%.2f' %(Time.now - t)} | #{ output_path}"
  end
  
  def output_folder_name_for_date(date)
    date.strftime '%yM%m'
  end
  
  def prognoz_output_path
    "#{ENV['DATA_PATH']}/datafiles/test_output/"
  end
  
  def create_output_folder
    Dir.mkdir prognoz_output_path+output_folder_name_for_date(Date.today) rescue 0
  end
  
  def output_dates
    dates = Array.new
    offset = 0
    offset = 1 if self.frequency == 'month'
    offset = 3 if self.frequency == 'quarter'
    offset = 6 if self.frequency == 'semi'
    offset = 12 if self.frequency == 'year'
    date = self.output_start_date
    while date < Date.today
      dates.push date.to_s
      date = date >> offset
    end
    dates
  end
  
  def write_dates(sheet,dates = output_dates)
    sheet[0,0] = 'DATE'
    count=1
    dates.sort.each do |date|
#      sheet[count,0] = ""
      sheet[count,0] = date
      count += 1
    end
  end
  
  def write_series(series_name, multiplier, sheet, dates = output_dates)
    col = series_loaded.keys.sort.index(series_name)+1
    sheet[0,col] = series_name.dup
    series = Series.get series_name
    count = 1
    dates.sort.each do |date|
      sheet[count,col] = series.at(date) / multiplier.to_f unless series.at(date).nil? or series.at(date).class == String
      count += 1
    end
  end
  
  def write_xls
    require 'spreadsheet'
    book = Spreadsheet::Workbook.new
    sheet1 = book.create_worksheet
    dates = output_dates
    write_dates(sheet1, dates)
    series_loaded.keys.sort.each do |name|
#      puts name
      write_series(name,1,sheet1,dates)
    end
    output_filename = filename.split('/')[-1]
    folder_path = prognoz_output_path+output_folder_name_for_date(Date.today)+'/'
    book.write "#{folder_path}#{output_filename}"
  end
end
