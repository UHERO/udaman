class IntegerPatternProcessor

  def initialize(pattern)
    @pattern = pattern
  end

  def compute(index, cached_files = nil, handle = nil, sheet = nil)
    Integer(@pattern)  ## if it's an integer literal, just return that, else... complication below
  rescue
    p = @pattern.split(':').map {|w| Integer(w) rescue w }  ## change integer strings to Integer type
    header_opts = { header_in: p[1], search_main: p[2], header_name: p[3], handle: handle, sheet: sheet }
    case p[0]
      when 'increment'    then increment(index, p[1], p[2])
      when 'repeat'       then range(index, p[1], p[2], p[3])
      when 'block'        then repeat(index, p[1], p[2], p[3])
      when 'header'       then find_header( header_opts.merge(match_type: p[4]) )
      when 'header_range' then find_header( header_opts.merge(match_type: p[6], search_start: p[4], search_end: p[5]) )
      else raise("IntegerPatternProcessor::compute: bad command word = #{p[0]}")
    end
  end

private

  def increment(index, start, step)
    start + (step * index)
  end

  def range(index, first, last, step)
    step ||= 1
    range = (last - first) / step + 1
    first + step * (index % range)
  end

  def repeat(index, start, step, repeat)
    start + step * (index / repeat).to_i
  end

  def find_header(opts)
    raise 'Find header needs a header_name' if opts[:header_name].blank?
    raise 'Find header needs a handle' if opts[:handle].blank?
    opts[:header_in] ||= 'col'
    opts[:match_type] = opts[:match_type].parameterize.underscore.to_sym rescue :hiwi
    opts[:search_main] ||= 1
    cache = DownloadsCache.new

    spreadsheet = opts[:sheet] ? cache.xls(opts[:handle], opts[:sheet]) : cache.csv(opts[:handle])

    search_start = opts[:search_start] || 1
    search_end = opts[:search_end] || compute_search_end(spreadsheet, opts)

    (search_start..search_end).each {|loc| return loc if match?(loc, spreadsheet, opts) }
    raise 'Cannot find header "%s" in handle %s' % [opts[:header_name], opts[:handle]]
  end

  def match?(loc, spreadsheet, opts)
    if opts[:header_in] == 'col'
      (row, col) = [loc, opts[:search_main]]
    else ## == 'row'
      (row, col) = [opts[:search_main], loc]
    end
    cell_value = opts[:sheet] ? spreadsheet.cell(row, col).to_s : spreadsheet[row - 1][col - 1].to_s

    opts[:header_name].split('[or]').each do |header|
      cell_matched = case opts[:match_type]
                     when :hiwi            then match_by_type(:equal, cell_value, header)
                     when :no_okina        then match_by_type(:equal, cell_value, header, true)
                     when :prefix          then match_by_type(:prefix, cell_value, header)
                     when :prefix_no_okina then match_by_type(:prefix, cell_value, header, true)
                     when :sub             then match_by_type(:substring, cell_value, header)
                     when :sub_no_okina    then match_by_type(:substring, cell_value, header, true)
                     when :trim_elipsis    then match_trim_elipsis(cell_value, header)
                     else raise("match?: bad match_type value = #{opts[:match_type]}")
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
    else raise("match_by_type: bad type value = #{type}")
    end
  end

  def match_trim_elipsis(value, header)
    return false if value.class != String
    value.strip.downcase == header.strip.downcase
  end

  def compute_search_end(spreadsheet, opts)
    case opts[:header_in]
    when 'col' then opts[:sheet] ? spreadsheet.last_row : spreadsheet.length
    when 'row' then opts[:sheet] ? spreadsheet.last_column : spreadsheet[0].length
    else raise("compute_search_end: bad header_in value = #{opts[:header_in]}")
    end
  end
end
