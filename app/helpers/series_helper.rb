module SeriesHelper
  include Validators
  require 'csv'
  require 'base64'

  def url_encode(str)
    'b64:' + Base64.urlsafe_encode64(str)
  end

  def url_decode(str)
    return str unless str =~ /^b64:/
    Base64.urlsafe_decode64(str.sub(/^b64:/, ''))
  end

  def index_header_get_params(header)
    # First, determine which route helper to use based on @index_action
    path_params = { sortby: header, dir: sortdir(header) }
    path_params[:search_string] = @b64_search_str if @b64_search_str

    # Map the action to the appropriate path helper
    case @index_action
    when 'index'
      series_index_path(path_params)
    when 'clipboard'
      clip_series_index_path(path_params)
    when 'quarantine'
      quarantine_series_index_path(path_params)
    when 'no_source'
      no_source_series_index_path(path_params)
    when 'no_source_no_restrict'
      no_source_no_restrict_series_index_path(path_params)
    # Add other actions as needed
    else
      # Default fallback
      series_index_path(path_params)
    end
  end

  def csv_helper
    series = @vintage ? @series.vintage_as_of(@vintage): @series
    values = series.data
    lvl = @vintage ? {} : @lvl_chg.data  ## disable lvl, yoy, ytd in case of vintage request
    yoy = @vintage ? {} : @chg.data
    ytd = @vintage ? {} : @ytd_chg.data
    dates = series.data.keys
    headers =  @vintage ? %w[Date Values] : %w[Date Values LVL YOY YTD]
    CSV.generate do |csv|
      csv << headers
      dates.sort.each do |date|
        csv << [date, values[date], lvl[date], yoy[date], ytd[date]]
      end
    end
  end

  def series_group_export(type, series)
    case type
      when 'metacsv' then series_meta_csv_gen(series)
      when 'datacsv' then series_data_csv_gen(series)
      when 'datatsd' then series_data_tsd_gen(series)
      else raise("series_group_export: unknown type #{type}")
    end
  end

  def series_meta_csv_gen(series_set)
    columns = %w{id name dataPortalName description geography.display_name_short frequency decimals
                 unit.short_label unit.long_label source.description source_link source_detail.description
                 seasonal_adjustment restricted restricted.to_01 quarantined quarantined.to_01 investigation_notes}
    CSV.generate(nil, col_sep: "\t") do |csv|
      csv << columns
      series_set.each do |s|
        csv << columns.map do |col|
          (attr, subattr) = col.split('.')
          subattr.nil? ? s.send(attr) : s.send(attr).send(subattr) rescue nil
        end
      end
    end
  end

  def series_data_csv_gen(series_set)
    CSV.generate do |csv|
      csv << ['Date'] + series_set.map(&:name)
      all_dates = series_set.map {|s| s.data.keys }.flatten.sort.uniq
      all_dates.each do |date|
        csv << [date] + series_set.map {|s| s.at(date) }
      end
    end
  end

  def series_data_tsd_gen(series_set)
    output = ''
    series_set.each do |s|
      begin
        output += s.to_tsd
      rescue => e
        Rails.logger.error { "series_data_tsd_gen: to_tsd conversion failure for #{s}: #{e.message}" }
      end
    end
    output
  end

  def do_csv2tsd_convert(upfilepath)
    tmpfile_rel = File.join('tmp', upfilepath.original_filename)
    tmpfile_full = File.join(ENV['DATA_PATH'], tmpfile_rel)
    series_set = []
    begin
      File.open(tmpfile_full, 'wb') {|f| f.write(upfilepath.read) }
      csv = UpdateSpreadsheet.new_xls_or_csv(tmpfile_rel)
      csv.header_strings.each do |name|
        s = name.tsn.load_from(tmpfile_rel)
        s.name = name
        series_set.push(s)
      end
    rescue StandardError => e
      Rails.logger.error e.message
      raise e.message
    ensure
      File.unlink(tmpfile_full)
    end
    series_data_tsd_gen(series_set)
  end

  def google_charts_data_table
    sorted_names = @all_series_to_chart.map {|s| s.name }
    dates_array = []
    @all_series_to_chart.each {|s| dates_array |= s.data.keys}
    dates_array.sort!
    series_data = {}
    @all_series_to_chart.each do |s|
      s_dates = {}
      dates_array.each {|date| s_dates[date] = s.data[date].to_s}
      series_data[s.name] = s_dates
    end
    rs = "data = new google.visualization.DataTable();\n"
    rs += "data.addColumn('string', 'date');\ndata.addColumn('number','"
    rs += sorted_names.join("');\n data.addColumn('number','")

    rs += "');\ndata.addRows(["
    dates_array.each do |date|
      rs += "['"+ date +"',"
      rs += sorted_names.map {|s| series_data[s][date] == "" ? "0" : series_data[s][date] }.join(", ") +"],\n"
    end
    rs += "]);\n"
  end

  def gct_datapoints(series)
    arr = series.data.keys.sort
    html =''
    arr.each do |key|
      html += "['#{key}',#{series.data[key]}]," unless series.data[key].nil?
    end
    #html += "['hi',10.0], ['bye', 30.0],"
    html.chop
  end

  def text_with_linked_download(text)
    return '' if text.blank?
    parts = text.split(DOWNLOAD_HANDLE)
    parts.each_with_index do |str, index|
      case valid_download_handle(str)
        when :nondate
          download = Download.get(str, :nondate)
          if download
            parts[index] = link_to(str, download)
          elsif text =~ /load_from_download/  ## ugh, but... reality
            parts[index] = '<span class="error_message" title="Non-existent download!">%s</span>' % parts[index]
          end
        when :date
          parts[index] = link_to(str, { controller: :downloads, action: :by_pattern, pat: str })
        else
          parts[index].gsub!(/\s+/, '&nbsp;') ## the old code did this, so I guess I gotta...
      end
    end
    parts.join
  end

  def text_with_linked_words(text, action = :show)
    return '' if text.blank?
    words = text.split(' ')
    words.each_with_index do |word, index|
      if valid_series_name(word)
        series = word.tsnil
        words[index] = link_to(word, { action: action, id: series }) if series
        next
      end
      if word =~ /^<(.*)>$/
        rel_path = $1
        if valid_data_path(rel_path)
          words[index] = link_to(word, { controller: :downloads, action: :pull_file, path: rel_path })
        end
        next
      end
   end
    words.join(' ')
  end

  def make_hyperlink(url, text = url)
    return text if url.blank?
    return "<a href='#{url}'>#{text}</a>".html_safe if valid_url(url)
    "<span class='error_message'>unvalidatable url=#{url}</span>".html_safe
  end

  def sa_indicator(string)
    sa_sym = string.to_sym rescue :none
    short = { not_applicable: 'NA', seasonally_adjusted: 'SA', not_seasonally_adjusted: 'NS' }[sa_sym] || 'NA'
    short == 'NA' ? '-' : "<span class='#{short.downcase}-indicator'>#{short}</span>".html_safe
  end

  def make_alt_universe_links(series)
    alt_univs = { 'UHERO' => %w{COH CCOM}, 'DBEDT' => %w{UHERO COH} }  ## Yes, these relations are hardcoded. So sue me.
    links = []
    seen = {}
    series.aliases.sort_by{|x| [x.is_primary? ? 0 : 1, x.universe] }.each do |s|
      links.push link_to(universe_label(s), { controller: :series, action: :show, id: s.id }, title: s.name)
      seen[s.universe] = true
    end
    if series.is_primary? && alt_univs[series.universe] && current_user.admin_user?
      ## Add creation links
      alt_univs[series.universe].each do |univ|
        next if seen[univ]
        # links.push link_to(univ_gray_create_label(univ), { controller: :series, action: :new_alias, id: series, new_univ: univ }, title: 'Create new')
        links.push link_to(univ_gray_create_label(univ), new_alias_series_path(series, new_univ: univ), title: 'Create new')
      end
    end
    links.join(' ')
  end

  def universe_label(series)
    series.is_primary? ? "<span class='primary_series'>#{series.universe}</span>".html_safe : series.universe
  end

  def univ_gray_create_label(text)
    "<span class='grayedout'>[#{text}]</span>".html_safe
  end

  def search_count_display(count)
    return count unless count == ENV['SEARCH_DEFAULT_LIMIT'].to_i
    "<span style='color:red;' title='Search results likely truncated because default limit reached. Use + to override'>#{count}</span>".html_safe
  end
end
