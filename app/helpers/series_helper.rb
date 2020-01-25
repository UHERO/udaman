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

  ## Method can be deleted right after story is complete
  def ua_1164_csv_generate
    #require 'nokogiri'
    CSV.generate(nil, {col_sep: "\t"}) do |csv|
      @old_bea_series.each do |s|
        ds = s.data_sources.reject {|d| d.eval =~ /load_from_bea/ }
        ds.each do |d|
          row = [s.name, d.eval]
          if d.eval =~ /load_from_download\s*"(.+?)"/
            if dl = Download.find_by(handle: $1)
              row.push "https://udaman.uhero.hawaii.edu/downloads/#{dl.id}"
            end
          end
          csv << row
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
  
  def linked_version(description)
    linked_version_with_action(description,'show')
  end
  
  def linked_version_with_action(description, action)
    return '' if description.blank?
    new_words = []
    description.split(' ').each do |word|
      new_word = word
      if valid_series_name(word)
        series = word.ts
        new_word = link_to(word, { action: action, id: series }) if series
      end
      new_words.push new_word
    end
    new_words.join(' ')
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

  def nightly_actuator(nightly)
    (nightly ? 'disable' : 'enable') + ' nightly reload'
  end

  def make_hyperlink(url, text = url)
    return url if url.blank?
    return "<a href='#{url}'>#{text}</a>".html_safe if valid_url(url)
    "<span style='color:red;font-weight:bold;'>unvalidatable url=#{url}</span>".html_safe
  end

  def sa_indicator(string)
    sa_sym = string.to_sym rescue :none
    short = { not_applicable: 'NA', seasonally_adjusted: 'SA', not_seasonally_adjusted: 'NS' }[sa_sym] || 'NA'
    short == 'NA' ? '-' : "<span class='#{short.downcase}-indicator'>#{short}</span>".html_safe
  end

  def make_alt_universe_links(series)
    alt_univs = { 'UHERO' => %w{COH}, 'DBEDT' => %w{UHERO COH} }  ## Yes, these relations are hardcoded. So sue me.
    links = []
    seen = {}
    series.aliases.sort_by{|x| [x.is_primary? ? 0 : 1, x.universe] }.each do |s|
      links.push link_to(universe_label(s), { controller: :series, action: :show, id: s.id }, title: s.name)
      seen[s.universe] = true
    end
    if series.is_primary?
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

end
