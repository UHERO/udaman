module SeriesHelper
  include Validators
  require 'csv'

  def csv_helper
    CSV.generate do |csv| 
      # series_data = @data_list.series_data
      # sorted_names = series_data.keys.sort
      # dates_array = @data_list.data_dates
      dates = @series.data.keys
      val = @series.data
      lvls = @lvl_chg.data
      yoy = @chg.data
      ytd = @ytd_chg.data
       
      csv << ["Date", "Values", "LVL","YOY", "YTD"]
      # dates_array.each do |date|
      #   csv << [date] + sorted_names.map {|series_name| series_data[series_name][date]}
      # end
      dates.sort.each do |date|
        csv << [date, val[date], lvls[date], yoy[date], ytd[date]]
      end
    end
  end

  def series_meta_csv_gen(series_set)
    columns = %w{id name dataPortalName description geography.display_name_short frequency
                 units unit.short_label unit.long_label source.description source_link source_detail.description
                 decimals seasonal_adjustment restricted.to_01 quarantined.to_01 investigation_notes}
    CSV.generate do |csv|
      csv << columns
      series_set.each do |s|
        csv << columns.map do |col|
          (attr, subattr) = col.split('.')
          s.send(attr).send(subattr || 'to_s') rescue nil
        end
      end
    end
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
        series = word.ts
        words[index] = link_to(word, { action: action, id: series }) if series
        next
      end
      if valid_data_path(word)
        rel_path = data_path_relativize(word)  ## relativize path under DATA_PATH prefix
        words[index] = link_to(word, { controller: :downloads, action: :pull_file, path: rel_path })
        next
      end
   end
    words.join(' ')
  end
  
  def aremos_color(diff)
#    diff = (val - aremos_val).abs
    mult = 5000
    gray = "99"
    red = (gray.hex + diff * mult).to_i
    green = (gray.hex - diff * mult).to_i
    blue = (gray.hex - diff * mult).to_i
    red = 255 if red > 255
    green = 20 if green < 20 
    blue = 20 if blue < 20
    "##{red.to_s(16)}#{green.to_s(16)}#{blue.to_s(16)}"
  end

  def make_hyperlink(url, text = url)
    return url if url.blank?
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
    if current_user.admin_user? && series.is_primary? && alt_univs[series.universe]
      ## Add creation links
      alt_univs[series.universe].each do |univ|
        next if seen[univ]
        links.push link_to(univ_create_label(univ), { controller: :series, action: :new_alias, id: series, new_univ: univ }, title: 'Create new')
      end
    end
    links.join(' ')
  end

  def universe_label(series)
    series.is_primary? ? "<span class='primary_series'>#{series.universe}</span>".html_safe : series.universe
  end

  def univ_create_label(text)
    "<span class='grayedout'>[#{text}]</span>".html_safe
  end

  def data_path_relativize(path)
    path.sub(ENV['DATA_PATH'] + '/', '')
  end
end
