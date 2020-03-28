class IntegerPatternProcessor

  def initialize(pattern)
    @pattern = pattern
  end

  def compute(index, cached_files = nil, handle = nil, sheet = nil)
    Integer(@pattern)  ## if it's an integer value, just return that, else... complication below
  rescue
    p = @pattern.split(':').map {|w| Integer(w) rescue w }  ## change integer strings to Integer type
    common_opts = { header_in: p[1], search_main: p[2], header_name: p[3], handle: handle, sheet: sheet }
    case p[0]
      when 'increment' then increment(index, p[1], p[2])
      when 'repeat'    then repeat_range(index, p[1], p[2], p[3])
      when 'block'     then repeat_x_times(index, p[1], p[2], p[3])
      when 'repeat_with_step' then repeat_range(index, p[1], p[2], p[3])
      when 'header'       then find_header( common_opts.merge(match_type: p[4]) )
      when 'header_range' then find_header(
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

  def find_header(options)
    raise 'Find header needs a header_name' if options[:header_name].blank?
    raise 'Find header needs a handle' if options[:handle].blank?
    header_in = options[:header_in] || 'col'
    match_type = options[:match_type] ? options[:match_type].parameterize.underscore.to_sym : :hiwi
    search_main = options[:search_main] || 1
    cache = DownloadsCache.new

    spreadsheet = options[:sheet] ? cache.xls(options[:handle], options[:sheet]) : cache.csv(options[:handle])

    search_start = options[:search_start] || 1
    search_end = options[:search_end] || compute_search_end(spreadsheet, header_in, options[:sheet])

    (search_start..search_end).each {|elem| return elem if match?(elem, spreadsheet, match_type, header_in, search_main, options)}
    raise "Could not find header: '#{options[:header_name]}'" #return nil
  end

  def match?(elem, spreadsheet, match_type, header_in, search_main, options)
    row = header_in == 'col' ? elem : search_main
    col = header_in == 'col' ? search_main : elem
    cell_value = options[:sheet] ? spreadsheet.cell(row, col).to_s : spreadsheet[row - 1][col - 1].to_s

    options[:header_name].split('[or]').each do |header|
      cell_matched = case match_type
                     when :hiwi            then match_by_type(:equal, cell_value, header)
                     when :no_okina        then match_by_type(:equal, cell_value, header, true)
                     when :prefix          then match_by_type(:prefix, cell_value, header)
                     when :prefix_no_okina then match_by_type(:prefix, cell_value, header, true)
                     when :sub             then match_by_type(:substring, cell_value, header)
                     when :sub_no_okina    then match_by_type(:substring, cell_value, header, true)
                     when :trim_elipsis    then match_trim_elipsis(cell_value, header)
                     else false
                     end
      return true if cell_matched
    end
    false
  end

  def match_by_type(type, value, header, no_okina = false)
    return false if value.class != String
    value = value.split('(')[0] if type === :equal && value != ''
    val_string = value.strip.downcase.to_ascii
    val_string = val_string.no_okina if no_okina
    case type
    when :equal     then val_string == header.strip.downcase
    when :prefix    then val_string.index(header.strip.downcase) == 0
    when :substring then val_string.include? header.strip.downcase
    else raise("match_by_type: unknown match type #{type}")
    end
  end

  def match_trim_elipsis(value, header)
    return false if value.class != String
    value.strip.downcase == header.strip.downcase
  end

  def compute_search_end(spreadsheet, header_in, is_sheet)
    case header_in
    when 'col' then is_sheet ? spreadsheet.last_row : spreadsheet.length
    when 'row' then is_sheet ? spreadsheet.last_column : spreadsheet[0].length
    else raise("compute_search_end: bad header_in value = #{header_in}")
    end
  end
end
