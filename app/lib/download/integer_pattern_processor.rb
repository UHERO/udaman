class IntegerPatternProcessor

  def initialize(pattern)
    @pattern = pattern
  end

  def compute(index, cached_files = nil, handle = nil, sheet = nil)
    Integer(@pattern)  ## if it's an integer value, just return that, else... complication below
  rescue
=begin
    return pos_by_increment(p[1].to_i, p[2].to_i, index) if p[0] == 'increment'
    return pos_by_repeating_number_x_times(p[1].to_i, p[2].to_i, p[3].to_i, index) if p[0] == 'block'
    return pos_by_repeating_numbers(p[1].to_i, p[2].to_i, index) if p[0] == 'repeat'
    return pos_by_repeating_numbers_with_step(p[1].to_i, p[2].to_i, p[3].to_i, index) if p[0] == 'repeat_with_step'
    # currently when processing headers. Has to search for every data point. Really only needs one search for file. This will probably be significantly
    # less efficient than the original process until we find a way to cache the header position
    return DownloadPreprocessor.find_header({:header_name => p[3],
                                             :header_in => p[1],
                                             :search_main => p[2].to_i,
                                             :match_type => p[4],
                                             :handle => handle,
                                             :sheet => sheet,
                                             :cached_files => cached_files}) if p[0] == 'header'
    return DownloadPreprocessor.find_header({:header_name => p[3],
                                             :header_in => p[1],
                                             :search_main => p[2].to_i,
                                             :match_type => p[6],
                                             :search_start => p[4].to_i,
                                             :search_end => p[5].to_i,
                                             :handle => handle,
                                             :sheet => sheet,
                                             :cached_files => cached_files}) if p[0] == 'header_range'
=end
    p = @pattern.split(':').map {|w| Integer(w) rescue w }  ## change integer strings to Integer type
    common_opts = { header_in: p[1], search_main: p[2], header_name: p[3], handle: handle, sheet: sheet }
    case p[0]
      when 'increment' then increment(index, p[1], p[2])
      when 'repeat'    then repeat_range(index, p[1], p[2], p[3])
      when 'block'     then repeat_x_times(index, p[1], p[2], p[3])
      when 'repeat_with_step' then repeat_range(index, p[1], p[2], p[3])
      when 'header'       then DownloadPreprocessor.find_header( common_opts.merge(match_type: p[4]) )
      when 'header_range' then DownloadPreprocessor.find_header(
          common_opts.merge(search_start: p[4], search_end: p[5], match_type: p[6])
      )
      else raise('IntegerPatternProcessor::compute ????')
    end
  end

private

  def increment(index, start, step)
    start + (step * index)
  end

  def repeat_range(index, first, last, step)
    step ||= 1
    range = (last - first) / step + 1
    first + (index % range) * step
  end

  def repeat_x_times(index, start, step, repeat)
    start + (index / repeat).to_i * step
  end

end
