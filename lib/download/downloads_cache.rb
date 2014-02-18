#CSV STUFF IS WEIRD... TRY TO CLEAN UP

class DownloadsCache
  def get_cache
    {:csv => @csv, :xls => @xls, :text => @text}
  end
  
  def new_data?
    return false if @new_data.nil?
    return true
  end
  
  def reset_new_data
    @new_data = nil
  end
  
  def xls(handle, sheet, path = nil)
    #puts handle+": "+sheet
    
    path = DataSourceDownload.flex(path) if handle == "manual"
    
    if path.nil?
      @dsd = DataSourceDownload.get(handle)
      raise "handle '#{handle}' does not exist" if @dsd.nil?
      path = (@dsd.extract_path_flex.nil? or @dsd.extract_path_flex == "") ? @dsd.save_path_flex : @dsd.extract_path_flex 
    end
    
    
    
    @cache_handle = path
    @handle = handle    
    @sheet = sheet
    @xls ||= {}
    
    
    download_handle if @xls[@cache_handle].nil? and handle != "manual" #if handle in cache, it was downloaded recently... need to pull this handle logic out to make less hacky
    @xls[@cache_handle] ||= {}
    set_xls_sheet if @xls[@cache_handle][sheet].nil? #if sheet not present, only other sheets were used so far
    @xls[@cache_handle][sheet]
  end

  def set_xls_sheet
    @new_data = true
    file_extension = @cache_handle.split(".")[-1]
    excel = file_extension == "xlsx" ? Roo::Excelx.new(@cache_handle) : Roo::Excel.new(@cache_handle) 
    sheet_parts = @sheet.split(":")
    if sheet_parts[0] == "sheet_num" #and excel.default_sheet != excel.sheets[sheet_parts[1].to_i - 1]
      excel.default_sheet = excel.sheets[sheet_parts[1].to_i - 1] 
    else
      begin
        excel.default_sheet = @sheet unless excel.default_sheet == @sheet 
      rescue RangeError
        # added sheetnames to allow for sheetnames separated by "[or]" (case insensitive)
        sheetnames = @sheet.split(/\[[oO][rR]\]/).collect! {|sheet| sheet.downcase} 
        # whitespace_hidden_sheet_index = (excel.sheets.map {|sheet| sheet.strip.downcase}).index(@sheet.downcase)
        whitespace_hidden_sheet_index = excel.sheets.index {|sheet| sheetnames.include?(sheet.strip.downcase)}
        if whitespace_hidden_sheet_index.nil?
          raise "sheet '#{@sheet}' does not exist in workbook '#{@dsd.save_path_flex}' [Handle: #{@handle}]"
        else
          excel.default_sheet = excel.sheets[whitespace_hidden_sheet_index]
        end
      end
    end
    @xls[@cache_handle] ||= {}
    @xls[@cache_handle][@sheet] = excel.to_matrix.to_a
  end

  def download_results
    @download_results ||= {}
    @download_results
  end

  def download_handle
    t = Time.now
    @download_results ||= {}
    @download_results[@handle] = @dsd.download 
    puts "#{Time.now - t} | cache miss: downloaded #{@handle}"
    raise "the download for handle '#{@handle} failed with status code #{@download_results[@handle][:status]} when attempt to reach #{@dsd.url}" if @download_results[@handle] and @download_results[@handle][:status] != 200
  end

  #this manual logic is getting ugly. should probably take out the option handling stuff and file caching and separate from download process, etc
  def csv(handle, path = nil)
    @dsd = DataSourceDownload.get(handle)
    raise "handle '#{handle}' does not exist" if @dsd.nil? and handle != "manual"
    path = (handle == "manual") ? DataSourceDownload.flex(path) : @dsd.save_path_flex    
    @handle = handle
    @csv ||= {}
    if @csv[path].nil? 
      download_handle unless @dsd.nil?
      #puts path
      begin
        @csv[path] = CSV.read(path)
        @new_data = true
      rescue
        #resolve one ugly known file formatting problem with faster csv
        alternate_csv_load = alternate_fastercsv_read(path) #rescue condition if this fails
        #return "READ_ERROR:CSV FORMAT OR FILE PROBLEM" if alternate_csv_load.nil? 
        @csv[path] = alternate_csv_load
        @new_data = true
      end
    end
    @csv[path]
  end


  def alternate_fastercsv_read(path)
    csv_data = []
    csv_file = open path, "r"
    while line = csv_file.gets
      next unless line.index("HYPERLINK").nil?
      # valid encoding solution is to deal with xA0 characters from this stack overflow post
      # http://stackoverflow.com/questions/8710444/is-there-a-way-in-ruby-1-9-to-remove-invalid-byte-sequences-from-strings
      csv_data.push(CSV.parse_line(line.strip.chars.select{|i| i.valid_encoding?}.join))
    end
    csv_file.close
    return csv_data 
  rescue
    puts "CSV is having a problem with the following line"
    puts line
    return [] #not sure about this change. Used to be nil. but got too time consuming
  end

  def text(handle)
    @dsd = DataSourceDownload.get(handle)
    raise "handle '#{handle}' does not exist" if @dsd.nil?
    
    @handle = handle
    @text ||= {}
    if @text[handle].nil?
      download_handle
      @text[handle] = get_text_rows
      @new_data = true
    end
    @text[handle]
  end

  def get_text_rows
    f = open @dsd.save_path_flex, "r"
    text_rows = []
    while row = f.gets
      text_rows.push row 
    end
    text_rows
  end
end
