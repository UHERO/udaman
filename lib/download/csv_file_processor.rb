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
    begin
      handle = @handle_processor.compute(index)
      date = @date_processor.compute(index)
      row = @row_processor.compute(index, @cached_files, handle)
      col = @col_processor.compute(index, @cached_files, handle)

      csv_2d_array = @cached_files.csv(handle, @options[:path], true)
    rescue EOFError
      Rails.logger.debug { "Skipping data point for handle=#{handle}, date=#{date} because source has not changed" }
      return {} ## data point skipped because file and data source defn have not changed. -dji
    rescue => e
      Rails.logger.error "CsvFileProcessor: #{e.message}"
      raise e
    end
    Rails.logger.debug { "PROCESSING data point for handle=#{handle}, date=#{date}" }
    observation_value = parse_cell(csv_2d_array, row, col)
    return 'END' if observation_value == 'BREAK IN DATA'
    @cached_files.update_last_used
    {date => observation_value}
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
