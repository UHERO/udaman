class DownloadsCache

  def xls(handle, sheet, path = nil, date = nil)
    if path.nil?
      @got_handle ||= {}
      @dsd = @got_handle[handle] || DataSourceDownload.get(handle)
      raise "handle '#{handle}' does not exist" if @dsd.nil?
      path = @dsd.extract_path_flex.blank? ? @dsd.save_path_flex : @dsd.extract_path_flex
      @got_handle[handle] = @dsd
    end
    
    @cache_handle = path
    @handle = handle    
    @sheet = sheet
    file_key = make_cache_key('xls', @cache_handle)
    sheet_key = make_cache_key('xls', @cache_handle, @sheet)

    #if handle in cache, it was downloaded recently... need to pull this handle logic out to make less hacky
    if handle != 'manual' && get_files_cache(file_key).nil?
      download_handle
      set_files_cache(file_key, 1)  ## Marker to show that file is downloaded
    end
    get_files_cache(sheet_key) || set_xls_sheet(sheet, date)
  end

  def set_xls_sheet(sheet, date)
    file_extension = @cache_handle.split('.')[-1]
    excel = file_extension == 'xlsx' ? Roo::Excelx.new(@cache_handle) : Roo::Excel.new(@cache_handle)
    sheet_parts = sheet.split(':')
    if sheet_parts[0] == 'sheet_num'
      excel.default_sheet = excel.sheets[sheet_parts[1].to_i - 1] 
    elsif sheet_parts[0] == 'sheet_name'
      excel.default_sheet = get_month_name(date) if sheet_parts[1].upcase == 'M3'
    else
      begin
        excel.default_sheet = sheet unless excel.default_sheet == sheet
      rescue RangeError
        # added sheetnames to allow for sheetnames separated by "[or]" (case insensitive)
        sheetnames = sheet.split(/\[[oO][rR]\]/).collect! {|s| s.downcase}
        whitespace_hidden_sheet_index = excel.sheets.index {|s| sheetnames.include?(s.strip.downcase)}
        if whitespace_hidden_sheet_index.nil?
          raise "sheet '#{sheet}' does not exist in workbook '#{@dsd.save_path_flex}' [Handle: #{@handle}]"
        else
          excel.default_sheet = excel.sheets[whitespace_hidden_sheet_index]
        end
      end
    end
    sheet_key = make_cache_key('xls', @cache_handle, sheet)
    set_files_cache(sheet_key, excel.to_matrix.to_a)
  end

  def download_results
    key = make_cache_key('download','results')
    get_files_cache(key) || {}
  end

  def csv(handle, path = nil)
    if path.nil?
      @got_handle ||= {}
      @dsd = @got_handle[handle] || DataSourceDownload.get(handle)
      raise "handle '#{handle}' does not exist" if @dsd.nil? && handle != 'manual'
      path = @dsd.save_path_flex if handle != 'manual'
      @got_handle[handle] = @dsd
    end
    @handle = handle
    file_key = make_cache_key('csv', path)
    value = get_files_cache(file_key)
    if value.nil?
      download_handle unless @dsd.nil?
      begin
        value = CSV.read(path)
      rescue
        #resolve one ugly known file formatting problem with faster csv
        value = alternate_fastercsv_read(path)
      ensure
        set_files_cache(file_key, value)
      end
    end
    value
  end

  def text(handle)
    @dsd = DataSourceDownload.get(handle)
    raise "handle '#{handle}' does not exist" if @dsd.nil?

    @handle = handle
    key = make_cache_key('txt', handle)
    value = get_files_cache(key)
    if value.nil?
      download_handle
      value = get_text_rows
      set_files_cache(key, value)
    end
    value
  end

  def get_text_rows
    f = open @dsd.save_path_flex, 'r'
    text_rows = []
    while (row = f.gets)
      text_rows.push row
    end
    text_rows
  end

private
  def download_handle
    t = Time.now
    key = make_cache_key('download','results')
    results = get_files_cache(key) || {}
    dsd_log = results[@handle] = @dsd.download
    puts "#{Time.now - t} | cache miss: downloaded #{@handle}"
    set_files_cache(key, results, {}) ## pass empty options hash to diable expiration timer -dji

    if dsd_log && dsd_log[:status] != 200
      raise "the download for handle '#{@handle}' failed with status code #{dsd_log[:status]} (url=#{@dsd.url})"
    end
  end

  def alternate_fastercsv_read(path)
    csv_data = []
    csv_file = open path, 'r'
    while (line = csv_file.gets)
      begin
        next unless line.index('HYPERLINK').nil?
        # valid encoding solution is to deal with xA0 characters from this stack overflow post
        # http://stackoverflow.com/questions/8710444/is-there-a-way-in-ruby-1-9-to-remove-invalid-byte-sequences-from-strings
        csv_data.push(CSV.parse_line(line.encode('UTF-8', invalid: :replace, undef: :replace, replace: '')))
      rescue
        puts 'CSV is having a problem with the following line'
        puts line
        csv_data.push([])
      end
    end
    csv_file.close
    csv_data
  end

  def make_cache_key(file_type, handle, sheet=nil)
    parts = [file_type, handle]
    parts.push(sheet) if sheet
    parts.join('|')
  end

  def get_files_cache(key)
    value = Rails.cache.fetch(key)
    value.nil? ? nil : Marshal.load(value)
  end

  def set_files_cache(key, value, options=nil)
    options ||= { expires_in: 6.hours }
    Rails.cache.write(key, Marshal.dump(value), options)
    value
  end

  def get_month_name(date)
    date.to_date.strftime('%^b')
  end

end
