module SeriesHelper
  
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
    return '' if description.nil?
    new_words = []
    description.split(' ').each do |word|
      #new_word = word.index('@').nil? ? word : link_to(word, {:action => 'show', :id => word.ts.id})
      new_word = word
      begin
        new_word = (word.index('@').nil? or word.split('.')[-1].length > 1) ? word : link_to(word, {:action => action, :id => word.ts.id}, :target=>'_blank' )
      rescue
        new_word = word
      end
      new_words.push new_word
    end
    new_words.join(' ')
  end
  
#  def aremos_color(val, aremos_val)
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
  
  def navigation_by_letter
    html = "<br />"
    all_uhero = Series.get_all_uhero
    "A".upto("Z") do |letter|
      count = all_uhero.where("name LIKE :name", { name: "#{letter}%" }).count
      if count > 0
        html += link_to raw("["+letter+"&nbsp;<span class='series_count'>#{count}</span>]"), {:action => 'index', :prefix => letter}
        html += " "
      end
    end
    html
  end
  
  def navigation_by_frequency
    html = ""
    all_uhero = Series.get_all_uhero
    [:month, :quarter, :year].each do |frequency|
      count = all_uhero.where(frequency: frequency).count
      html += link_to raw(frequency.to_s + "&nbsp;<span class='series_count'>#{count}</span>"), {:action => 'index', :freq => frequency}
      html += "&nbsp;"
    end
    count = all_uhero.count
	  html + link_to raw("all&nbsp;<span class='series_count'>#{count}</span>") , {:action => 'index', :all => 'true'}
  end

  def nightly_actuator(nightly)
    (nightly ? 'disable' : 'enable') + ' nightly reload'
  end
end
