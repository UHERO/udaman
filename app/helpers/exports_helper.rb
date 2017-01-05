module ExportsHelper
  def exports_csv_helper
    CSV.generate do |csv|
      series_data = @export.series_data
      puts 'series_data:', series_data
      names = Export.connection.execute(%Q|SELECT series.name AS name
          FROM export_series
          LEFT JOIN series ON series.id = export_series.series_id
          WHERE export_series.export_id = #{@export.id}
          ORDER BY export_series.list_order;|).to_a.flatten
      puts 'names:', names
      dates_array = @export.data_dates
      puts 'data_array:', dates_array
      csv << ['date'] + names
      dates_array.each do |date|
        csv << [date] + names.map {|series_name| series_data[series_name][date]}
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
    dates_array.each {|date| rs += "['"+ date.strftime('%Y-%m-%d') +"'," + sorted_names.map {|s| series_data[s][date].nil? ? 0 : series_data[s][date] }.join(', ') +"],\n"}
    rs + "]);\n"
  end
end
