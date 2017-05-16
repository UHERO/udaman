class DownloadsCache
  def initialize
    @cache = {}
  end

  def csv_count
    @cache.keys.select {|key| key =~ /^csv/ }.count
  end

  def xls_count
    @cache.keys.select {|key| key =~ /^xls/ }.count
  end

  def text_count
    @cache.keys.select {|key| key =~ /^text/ }.count
  end

  def new_data?
    !@new_data.nil?
  end
  
  def reset_new_data
    @new_data = nil
  end

  def write_cache
    @cache.keys.each do |handle|
      Rails.cache.fetch(handle, expires_in: 6.hours) { Marshal.dump(@cache[handle]) }
    end
  end

  def get_rails_cache(key)
    Rails.cache.fetch(key)
  end

  def set_rails_cache(key, value)
    Rails.cache.fetch(key, expires_in: 6.hours) { Marshal.dump(value) }
  end

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
    if get_rails_cache(file_key).nil? && handle != 'manual'
      download_handle
      set_rails_cache(file_key, 1)  ## Marker to show that file is downloaded
    end
    get_rails_cache(sheet_key) || set_xls_sheet(sheet, date)
  end

  def set_xls_sheet(sheet, date)
    @new_data = true
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
    set_rails_cache(sheet_key, excel.to_matrix.to_a)
  end

  def make_cache_key(file_type, handle, sheet=nil)
    parts = [file_type, handle]
    parts.push(sheet) if sheet
    parts.join('|')
  end

  def get_month_name(date)
    date.to_date.strftime('%^b')
  end

  def download_results
    @download_results ||= {}
  end

  def download_handle
    t = Time.now
    @download_results ||= {}
    @download_results[@handle] = @dsd.download 
    puts "#{Time.now - t} | cache miss: downloaded #{@handle}"
    if @download_results[@handle] && @download_results[@handle][:status] != 200
      raise "the download for handle '#{@handle}' failed with status code #{@download_results[@handle][:status]} (url=#{@dsd.url})"
    end
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
    key = make_cache_key('csv', handle)
    if @cache[key].nil?
      download_handle unless @dsd.nil?
      begin
        @cache[key] = CSV.read(path)
        @new_data = true
      rescue
        #resolve one ugly known file formatting problem with faster csv
        @cache[key] = alternate_fastercsv_read(path)
        @new_data = true
      end
    end
    @cache[key]
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

  def text(handle)
    @dsd = DataSourceDownload.get(handle)
    raise "handle '#{handle}' does not exist" if @dsd.nil?
    
    @handle = handle
    key = make_cache_key('txt', handle)
    if @cache[key].nil?
      download_handle
      @cache[key] = get_text_rows
      @new_data = true
    end
    @cache[key]
  end

  def get_text_rows
    f = open @dsd.save_path_flex, 'r'
    text_rows = []
    while (row = f.gets)
      text_rows.push row 
    end
    text_rows
  end
end
