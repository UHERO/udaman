#can use allow_blanks as an option for handling blanks
class XlsFileProcessor
  #job of this object is to coordinate all of the other processor objects for the mapping
  def initialize(handle, options, date_info, cached_files)
    @cached_files = cached_files
    @row_processor = IntegerPatternProcessor.new(options[:row])
    @col_processor = IntegerPatternProcessor.new(options[:col])
    @handle_processor = StringWithDatePatternProcessor.new handle
    @path_processor = options[:path] && StringWithDatePatternProcessor.new(options[:path])
    @sheet_processor = StringWithDatePatternProcessor.new options[:sheet]
    @date_processor = DatePatternProcessor.new date_info[:start], options[:frequency], date_info[:rev]
  end

  def observation_at(index)
    date = @date_processor.compute(index)
    handle = @handle_processor.compute(date)
    sheet = @sheet_processor.compute(date)
    path = @path_processor.nil? ? nil : @path_processor.compute(date)
    observation_value = nil
    skip = nil

    begin
      row = @row_processor.compute(index, @cached_files, handle, sheet)
      col = @col_processor.compute(index, @cached_files, handle, sheet)
      (worksheet, skip) = @cached_files.xls(handle, sheet, path, date, true)
      observation_value = parse_cell(worksheet.cell(row, col))
    rescue RuntimeError => e
      Rails.logger.error e.message unless @handle_processor.date_sensitive? || (@path_processor && @path_processor.date_sensitive?)
      #date sensitive means it might look for handles that don't exist
      #not sure if this is the right thing to do. Will get an indication from the daily download checks, but not sure if will see if you just 
      #load the data other than missing some values... not gonna do this just yet because it was rake that errored out not the series. might try to
      #do a rake trace next time it breaks to check better
      if e.message =~ /^(handle|path).*not exist/
        return 'END' if $1 == 'handle' && @handle_processor.date_sensitive?
        return 'END' if $1 == 'path' && @path_processor.date_sensitive?
      end
      ### I don't know what problem the following line is supposed to solve, but I hate it :(
      return {} if e.message =~ /^cannot find header.*Condo only/i
      raise e
    rescue IOError => e
      Rails.logger.error e.message
      return 'END' if e.message =~ /^file/ && @path_processor && @path_processor.date_sensitive?
      raise e
    end

    if observation_value == 'BREAK IN DATA'
      return @handle_processor.date_sensitive? ? { :skip => skip } : 'END';
    end
    unless skip
      @cached_files.mark_handle_used(handle)
    end
    { date => observation_value, :skip => skip }
  end

  def parse_cell(cell_value)
    begin
      return Float cell_value.to_s.gsub(/[,]/, '')
    rescue
      #known data values that should be suppressed as nils... may need to separate these by file being read in
      return nil if ['(D) ', '(L) ', '(N) ', '(T) ', 'no data'].include? cell_value
      return 'BREAK IN DATA'
    end
  end

end
