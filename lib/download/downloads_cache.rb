class DownloadsCache

  def initialize(handle, path = nil)
    @got_download = {}
    set_instance_vars(handle, path)
  end

  def set_instance_vars(handle, path = nil)
    if path.nil?
      @dsd = @got_download[handle] || Download.get(handle) || raise("handle '#{handle}' does not exist")
      path = @dsd.extract_path_flex.blank? ? @dsd.save_path_flex : @dsd.extract_path_flex
      @got_download[handle] = @dsd
    end
    @handle = handle
    @path = path
  end

  def xls(handle, sheet, path = nil, date = nil)
    logger.debug { "... Entered method xls ... handle=#{handle}, sheet=#{sheet}, path=#{path}" }
    set_instance_vars(handle, path)
    @sheet = @dsd.sheet_override.blank? ? sheet : @dsd.sheet_override.strip
    file_key = make_cache_key('xls', @path)
    sheet_key = make_cache_key('xls', @path, @sheet)

    #if handle in cache, it was downloaded recently... need to pull this handle logic out to make less hacky
    if handle != 'manual' && !Rails.cache.exist?(file_key)
      logger.debug { "!!! xls cache miss for file_key=#{file_key}" }
      download_handle
      set_files_cache(file_key, 1)  ## Marker to show that file is downloaded
    end
    get_files_cache(sheet_key) || set_xls_sheet(@sheet, date)
  end

  def set_xls_sheet(sheet, date)
    logger.debug { "... Entered method set_xls_sheet ... sheet=#{sheet}, date=#{date}" }
    file_extension = @path.split('.')[-1]
    excel = file_extension == 'xlsx' ? Roo::Excelx.new(@path) : Roo::Excel.new(@path)
    sheet_parts = sheet.split(':')
    def_sheet = case
      when sheet_parts[0] == 'sheet_num' then
        excel.sheets[sheet_parts[1].to_i - 1]
      when sheet_parts[0] == 'sheet_name' && sheet_parts[1].upcase == 'M3' then
        get_month_name(date)
      when sheet =~ /\[or\]/i then
        sheetnames = sheet.split(/\[or\]/i).collect! {|s| s.strip.downcase }
        index = excel.sheets.index {|s| sheetnames.include?(s.strip.downcase) }
        index.nil? ? nil : excel.sheets[index]
      else # explicit sheet name given, but check case-insensitively
        index = excel.sheets.index {|s| sheet.downcase == s.strip.downcase }
        index.nil? ? nil : excel.sheets[index]
    end
    begin
      excel.default_sheet = def_sheet
    rescue
      raise "sheet name/spec '#{def_sheet.to_s}' not found in workbook '#{@dsd.save_path_flex}' [handle: #{@handle}]"
    end
    sheet_key = make_cache_key('xls', @path, sheet)
    set_files_cache(sheet_key, excel.to_matrix.to_a)
  end

  def download_results
    logger.debug { '... Entered method download_results' }
    key = make_cache_key('download','results')
    get_files_cache(key) || {}
  end

  def csv(handle, path = nil)
    logger.debug { "... Entered method csv ... handle=#{handle}, path=#{path}" }
    set_instance_vars(handle, path)
    file_key = make_cache_key('csv', @path)
    value = get_files_cache(file_key)
    if value.nil?
      logger.debug { "!!! csv cache miss for file_key=#{file_key}" }
      download_handle
      begin
        value = CSV.read(@path)
      rescue
        #resolve one ugly known file formatting problem with faster csv
        value = alternate_fastercsv_read(@path)
      ensure
        set_files_cache(file_key, value)
      end
    end
    value
  end

  def text(handle)
    logger.debug { "... Entered method text ... handle=#{handle}" }
    set_instance_vars(handle, nil)
    file_key = make_cache_key('txt', @path)
    value = get_files_cache(file_key)
    if value.nil?
      logger.debug { "!!! txt cache miss for file_key=#{file_key}" }
      download_handle
      value = get_text_rows
      set_files_cache(file_key, value)
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

  def download_handle
    logger.debug { "... Entered method download_handle ... @handle=#{@handle}" }
    t = Time.now
    key = make_cache_key('download','results')
    results = get_files_cache(key) || {}
    dsd_log = results[@handle] = @dsd.download
    logger.info { "#{Time.now - t} | cache miss: downloaded #{@handle}" }
    set_files_cache(key, results, {}) ## pass empty options hash to disable expiration timer -dji

    if dsd_log && dsd_log[:status] != 200
      raise "the download for handle '#{@handle}' failed with status code #{dsd_log[:status]} (url=#{@dsd.url})"
    end
    dsd_log
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
    logger.debug { "<<< Entered method get_files_cache, key=#{key}" }
    value = Rails.cache.fetch(key)
    value.nil? ? nil : Marshal.load(value)
  end

  def set_files_cache(key, value, options=nil)
    logger.debug { ">>> Entered method set_files_cache, key=#{key}" }
    options ||= { expires_in: 6.hours }
    Rails.cache.write(key, Marshal.dump(value), options)
    value
  end

  def get_month_name(date)
    date.to_date.strftime('%^b')
  end

end
