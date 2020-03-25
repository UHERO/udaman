require 'roo'
require 'csv'

class DownloadPreprocessor

  ### obsolete and can be removed?
  def DownloadPreprocessor.xls(desc, handle, sheet, cached_files=nil)
    return desc unless desc.class == String
    p = desc.split ':'
    return desc unless p[0] == 'header'
    res = nil
    res = DownloadPreprocessor.find_xls_header_row_in_col(p[2].to_i, p[3], handle, sheet, cached_files) if p[1] == 'col'
    res = DownloadPreprocessor.find_xls_header_col_in_row(p[2].to_i, p[3], handle, sheet, cached_files) if p[1] == 'row'
    return res
  end

  ### obsolete and can be removed?
  def DownloadPreprocessor.csv(desc, handle, cached_files=nil)
    return desc unless desc.class == String
    p = desc.split ':'
    return desc unless p[0] == 'header'
    return DownloadPreprocessor.find_csv_header_row_in_col(p[2].to_i, p[3], handle, cached_files) if p[1] == 'col'
    return DownloadPreprocessor.find_csv_header_col_in_row(p[2].to_i, p[3], handle, cached_files) if p[1] == 'row'
    return desc
  end  

  def DownloadPreprocessor.find_header(options)
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

private

  def match?(elem, spreadsheet, match_type, header_in, search_main, options)
    row = header_in == 'col' ? elem : search_main
    col = header_in == 'col' ? search_main : elem
    cell_value = options[:sheet] ? spreadsheet.cell(row, col).to_s : spreadsheet[row - 1][col - 1].to_s

    options[:header_name].split('[or]').each do |header|
      cell_matched = case match_type
        when :hiwi            then match(cell_value, header)
        when :no_okina        then match(cell_value, header, true)
        when :prefix          then match_prefix(cell_value, header)
        when :prefix_no_okina then match_prefix(cell_value, header, true)
        when :trim_elipsis    then match_trim_elipsis(cell_value,header)
        when :sub             then match_sub(cell_value, header)
        when :sub_no_okina    then match_sub(cell_value, header, true)
        else false
      end
      return true if cell_matched
    end
    false
  end

  def match(value, header, no_okina = false)
    return false if value.class != String
    value = value.split('(')[0] unless value == ''
    val_string = value.strip.downcase.to_ascii
    val_string = val_string.no_okina if no_okina
    val_string == header.strip.downcase
  end

  def match_prefix(value, header, no_okina = false)
    return false if value.class != String
    val_string = value.strip.downcase.to_ascii
    val_string = val_string.no_okina if no_okina
    val_string.index(header.strip.downcase) == 0
  end

  def match_sub(value, header, no_okina = false)
    return false if value.class != String
    val_string = value.strip.downcase.to_ascii
    val_string = val_string.no_okina if no_okina
    val_string.include? header.strip.downcase
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
