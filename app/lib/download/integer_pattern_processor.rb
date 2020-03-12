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
    p = @pattern.split(':')
    header_opts = { header_in: p[1], search_main: p[2].to_i, header_name: p[3], handle: handle, sheet: sheet }
    case p[0]
      when 'increment' then pos_by_increment(p[1].to_i, p[2].to_i, index)
      when 'repeat'    then pos_by_repeating_numbers(p[1].to_i, p[2].to_i, index)
      when 'block'     then pos_by_repeating_number_x_times(p[1].to_i, p[2].to_i, p[3].to_i, index)
      when 'repeat_with_step' then pos_by_repeating_numbers_with_step(p[1].to_i, p[2].to_i, p[3].to_i, index)
      when 'header' then DownloadPreprocessor.find_header(:header_name => p[3],
                                                           :header_in => p[1],
                                                           :search_main => p[2].to_i,
                                                           :match_type => p[4],
                                                           :handle => handle,
                                                           :sheet => sheet,
                                                           :cached_files => cached_files)
      when 'header_range' then DownloadPreprocessor.find_header(:header_name => p[3],
                                                                 :header_in => p[1],
                                                                 :search_main => p[2].to_i,
                                                                 :match_type => p[6],
                                                                 :search_start => p[4].to_i,
                                                                 :search_end => p[5].to_i,
                                                                 :handle => handle,
                                                                 :sheet => sheet,
                                                                 :cached_files => cached_files)
      else raise('????')
    end
  end

private

  def pos_by_increment(start, step, index)
    start + (step * index)
  end

  def pos_by_repeating_numbers_with_step(first, last, step, index)
    range = (last - first) / step + 1
    (index % range) * step + first
  end

  def pos_by_repeating_numbers(first, last, index)
    range = last - first + 1
    (index % range) + first
  end

  def pos_by_repeating_number_x_times(start, step, repeat, index)
    start + (index / repeat).truncate * step
  end
end
