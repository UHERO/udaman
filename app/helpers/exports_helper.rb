module ExportsHelper
  def exports_csv_helper
    CSV.generate do |csv|
      names = @export.export_series.order(:list_order).map {|es| es.series.name }
      data = @export.series_data
      csv << ['date'] + names
      @export.data_dates.each do |date|
        csv << [date] + names.map {|series_name| data[series_name][date] }
      end
    end
  end

  def exports_google_charts_list
    series_data = @export.series_data
    sorted_names = series_data.keys.sort
    dates_array = @export.data_dates
    series_data_arrays = {}
    sorted_names.each {|s| series_data_arrays[s] = dates_array.map {|date| series_data[s][date].to_s} }
    rs = "data = new google.visualization.DataTable();\n" <<
    "data.addColumn('string', 'date');\ndata.addColumn('number','" <<
    sorted_names.join("');\n data.addColumn('number','") <<
    "');\ndata.addRows(["
    dates_array.each {|date| rs += "['"+ date.strftime('%Y-%m-%d') +"'," + sorted_names.map {|s| series_data[s][date] || 0 }.join(', ') +"],\n" }
    rs + "]);\n"
  end

  def sorthead(head)
    return head unless @sortby.downcase == head.downcase
    "#{head} <i class='fas fa-angle-#{@dir}' aria-hidden='true'></i>".html_safe
  end

  def sortdir(head)
    return 'up' unless @sortby.downcase == head.downcase
    @dir == 'up' ? 'down' : 'up'
  end
end
