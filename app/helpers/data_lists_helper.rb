module DataListsHelper
  require 'csv'

  def json_from_heroku_tsd(series_name, tsd_file)
    url = URI.parse("http://readtsd.herokuapp.com/open/#{tsd_file}/search/#{series_name[0..-3]}/json")
    res = Net::HTTP.new(url.host, url.port).request_get(url.path)
    data = res.code == "500" ? nil : JSON.parse(res.body)  
  end
  
  def csv_helper_data_list
    CSV.generate do |csv| 
      series_data = @data_list.series_data
      names = @data_list.series_names
      dates_array = @data_list.data_dates
       
      csv << ["date"] + names
      dates_array.each do |date|
        csv << [date] + names.map {|series_name| series_data[series_name][date]}
      end
    end
  end
  
  def js_data_raw
    series_data = @data_list.series_data
    sorted_names = series_data.keys.sort
    dates_array = @data_list.data_dates
    series_data_arrays = {}
    sorted_names.each {|s| series_data_arrays[s] = dates_array.map {|date| series_data[s][date].to_s} }
    rs = ""
    rs += "{\n"
    rs += "\"dates\" : [\"#{dates_array.join("\", \"")}\"],\n"
    rs += "\"data\" : {\n"
    sorted_names.each {|s| rs += "\""+ s + "\" : [" + series_data_arrays[s].join(", ") + "],\n"}
    rs += "}\n"
    rs += "}\n"
    rs
  end
  
  def google_charts_data_table_list
    series_data = @data_list.series_data
    sorted_names = series_data.keys.sort
    dates_array = @data_list.data_dates
    series_data_arrays = {}
    sorted_names.each {|s| series_data_arrays[s] = dates_array.map {|date| series_data[s][date].to_s} }
    rs = "data = new google.visualization.DataTable();\n"
    rs += "data.addColumn('string', 'date');\ndata.addColumn('number','"
    rs += sorted_names.join("');\n data.addColumn('number','")
    
    rs += "');\ndata.addRows(["
    dates_array.each {|date| rs += "['"+ date.strftime('%Y-%m-%d') +"'," + sorted_names.map {|s| series_data[s][date].nil? ? 0 : series_data[s][date] }.join(", ") +"],\n"}
    rs += "]);\n"
    rs
  end

  def make_indentation(n)
    ## HTML string below needs to keep internal quotes as single, because it gets embedded in JSON
    ## Start at 1 because if n == 0, this gives (correct) empty result, whereas 0..0 incorrectly iterates once
    (1..n).map{ "<i class='fa fa-minus' aria-hidden='true'></i> " }.join.html_safe
  end

  def generate_filter_controls(geo, freq, sa)
    x += select_tag('geography', options_from_collection_for_select(Geography.where(universe: 'foo'), 'id', 'display_name_short'))
    x += select_tag('frequency', options_for_select(%w(A S Q M W D), selected: freq))
    x += select_tag('seasonal_adj', options_for_select(%w(seasonally-adjusted not-seasonally-adjusted not-applicable), selected: sa))
  end
end
