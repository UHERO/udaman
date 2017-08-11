class CsvFileProcessor
  def initialize(handle, options, date_info, cached_files)
    @cached_files = cached_files
    @options = options
    @row_processor = IntegerPatternProcessor.new options[:row]
    @col_processor = IntegerPatternProcessor.new options[:col]
    @handle_processor = StringWithDatePatternProcessor.new handle
    @date_processor = DatePatternProcessor.new date_info[:start], options[:frequency], date_info[:rev]
  end

  def observation_at(index)
    skip = observation_value = nil

    begin
      handle = @handle_processor.compute(index)
      date = @date_processor.compute(index)
      row = @row_processor.compute(index, @cached_files, handle)
      col = @col_processor.compute(index, @cached_files, handle)
      (csv_2d_array, skip) = @cached_files.csv(handle, @options[:path], true)
      observation_value = parse_cell(csv_2d_array, row, col)
    rescue => e
      Rails.logger.error "CsvFileProcessor: #{e.message}"
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

  def parse_cell(csv_2d_array, row, col)
    begin
      cell_value = csv_2d_array[row-1][col-1]
      return Float cell_value.gsub(',','') if cell_value.class == String
      return Float cell_value
    rescue   
      #known data values that should be suppressed as nils... may need to separate these by file being read in
      return nil if ['(D) ', '(L) ', '(N) ', '(T)', '(T) ', ' --- ', '(L)', '(D)', '(NA)'].include? cell_value
      return 'BREAK IN DATA'
    end
  end

end
