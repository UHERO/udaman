class DownloadsCache

  def initialize(options = nil)
    @obj_cache = {}
    @dload = @dsd = @data_source = ds_id = nil
    @options = options
    if options
      ds_id = options.delete :data_source  ## get DS id (if any) and also remove from options hash
      @options = Hash[options.sort].to_json.downcase  ## slick. serialize hash in key-sorted order. -dji
    end
    if ds_id
      @data_source = DataSource.find(ds_id) || raise("No data source with id='#{ds_id}' found")
    end
  end

  def setup_and_check(handle, path = nil, raise_eof = false)
    Rails.logger.debug { "... Entered method setup_and_check: handle=#{handle}, path=#{path}" }
    if path.nil?  ## this means that handle != 'manual'
      @dload = @obj_cache[handle] || Download.get(handle) || raise("No handle '#{handle}' found")
      @obj_cache[handle] = @dload
      path = @dload.extract_path_flex.blank? ? @dload.save_path_flex : @dload.extract_path_flex

      download_handle

      if @data_source && raise_eof
        bridge_key = @data_source.id.to_s + '_' + @dload.id.to_s
        @dsd = @obj_cache[bridge_key] || DataSourceDownload.get_or_new(@data_source.id, @dload.id)
        @obj_cache[bridge_key] = @dsd
        if @dload.last_change_at <= @dsd.last_file_vers_used && @options == @dsd.last_eval_options_used
          raise EOFError ## used as a convenient surrogate to mean 'nothing more to do here'. -dji
        end
      end
    end
    @handle = handle
    @path = path
  end

  def update_last_used
    return unless @dsd
    ## Remember if this object has updated the dsd recently and don't redo an identical one. -dji
    return if @obj_cache['last_file'] == @dload.last_change_at && @obj_cache['last_eval'] == @options
    @obj_cache['last_file'] = @dload.last_change_at
    @obj_cache['last_eval'] = @options
    @dsd.update last_file_vers_used: @obj_cache['last_file'], last_eval_options_used: @obj_cache['last_eval']
  end

  def xls(handle, sheet, path = nil, date = nil, raise_eof = false)
    Rails.logger.debug { "... Entered method xls: handle=#{handle}, sheet=#{sheet}, path=#{path}" }
    setup_and_check(handle, path, raise_eof)
    set_files_cache(make_cache_key('xls', @path), 1)  ## Marker to show that file is downloaded
    sheet = @dload.sheet_override.strip if @dload && !@dload.sheet_override.blank?
    sheet_key = make_cache_key('xls', @path, sheet)
    get_files_cache(sheet_key) || set_xls_sheet(sheet, date)
  end

  def set_xls_sheet(sheet, date)
    Rails.logger.debug { "... Entered method set_xls_sheet: sheet=#{sheet}, date=#{date}" }
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
      raise "sheet name/spec '#{def_sheet.to_s}' not found in workbook '#{@dload.save_path_flex}' [handle: #{@handle}]"
    end
    sheet_key = make_cache_key('xls', @path, sheet)
    set_files_cache(sheet_key, excel.to_matrix.to_a)
  end

  def csv(handle, path = nil, raise_eof = false)
    Rails.logger.debug { "... Entered method csv: handle=#{handle}, path=#{path}" }
    setup_and_check(handle, path, raise_eof)
    file_key = make_cache_key('csv', @path)
    value = get_files_cache(file_key)
    if value.nil?
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

  def text(handle, raise_eof = false)
    Rails.logger.debug { "... Entered method text: handle=#{handle}" }
    setup_and_check(handle, nil, raise_eof)
    file_key = make_cache_key('txt', @path)
    value = get_files_cache(file_key)
    if value.nil?
      value = get_text_rows
      set_files_cache(file_key, value)
    end
    value
  end

  def get_text_rows
    f = open @dload.save_path_flex, 'r'
    text_rows = []
    while (row = f.gets)
      text_rows.push row
    end
    text_rows
  end

  def download_handle
    Rails.logger.debug { "... Entered method download_handle: @handle=#{@handle}" }
    t = Time.now
    return nil if @dload.last_download_at && @dload.last_download_at > (t - 1.hour) ## no redownload if very recent -dji

    key = make_cache_key('download','results')
    results = get_files_cache(key) || {}
    dsd_log = results[@handle] = @dload.download
    Rails.logger.info { "#{Time.now - t} | cache miss: downloaded #{@handle}" }
    set_files_cache(key, results, {}) ## pass empty options hash to disable expiration timer -dji

    if dsd_log && dsd_log[:status] != 200
      raise "the download for handle '#{@handle}' failed with status code #{dsd_log[:status]} (url=#{@dload.url})"
    end
    dsd_log
  end

  def download_results
    Rails.logger.debug { '... Entered method download_results' }
    key = make_cache_key('download','results')
    get_files_cache(key) || {}
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
    Rails.logger.debug { "<<< Entered method get_files_cache, key=#{key}" }
    value = Rails.cache.fetch(key)
    value.nil? ? nil : Marshal.load(value)
  end

  def set_files_cache(key, value, options=nil)
    Rails.logger.debug { ">>> Entered method set_files_cache, key=#{key}" }
    options ||= { expires_in: 6.hours }
    Rails.cache.write(key, Marshal.dump(value), options)
    value
  end

  def get_month_name(date)
    date.to_date.strftime('%^b')
  end

end
