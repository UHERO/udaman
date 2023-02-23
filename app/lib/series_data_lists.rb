module SeriesDataLists
  def Series.grab_data(list, start_date = Date.new(1900))
    series_data = {}
    list.each do |s|
      series = s.tsnil
      series_data[s] = series.nil? ? {} : series.get_values_after_including(start_date)
    end
    series_data
  end
  
  
  def Series.get_all_dates_from_data(data)
    dates_array = []
    data.each {|_, series_data| dates_array |= series_data.keys}
    dates_array.sort
  end

  def Series.write_data_list(list, output_path, start_date = Date.new(1900))
    series_data = grab_data(list, start_date)
    xls = prep_xls series_data, output_path
    write_xls_text(series_data, output_path)
    return write_xls xls, output_path
  end
  
  def Series.write_data_list_tsd(list, output_path)
    open(output_path, 'w') do |f|
      list.each do |name|
        # This is written so that if anything blows up in the to_tsd method,
        # or if the series doesn't exist, then NOTHING at all gets output. Be
        # careful if you try to change it. If puts outputs even just a newline, it
        # will break Aremos import.
        f.puts name.ts.to_tsd rescue ''
      end
    end
  end

private
  def Series.prep_xls(series_data, output_path)
      require 'spreadsheet'
    xls = Spreadsheet::Workbook.new output_path
    sheet1 = xls.create_worksheet
    dates = get_all_dates_from_data(series_data)
    write_dates dates.map {|date| date.strftime '%Y-%m-%d'}, sheet1
    col = 1
    series_data.sort.each do |name, data|
      write_series(name, data, sheet1, col, dates)
      col += 1
    end
    return xls
  end
  
  def Series.write_series(series_name, data, sheet, col, dates)
    sheet[0,col] = series_name.dup.chop.chop
    return if data.nil?
    count = 1
    dates.each do |date|
      sheet[count,col] = data[date] unless data[date].nil?
      count += 1
    end
  end

  def Series.write_dates(dates, sheet)
    sheet[0,0] = 'DATE'
    count=1
    dates.each do |date|
      sheet[count,0] = date
      count += 1
    end
  end
  
  def Series.write_xls(xls, output_path)
    old_file, old_file_s = nil, nil
    changed = true
    if File::exists?(output_path)
      old_file = open(output_path, 'rb').read
      old_file_xls = Roo::Excel.new(output_path)
      old_file_s = old_file_xls.to_s
    end
    xls.write output_path
    unless old_file_s.nil?
      new_file_xls = Roo::Excel.new(output_path)
      changed = new_file_xls.to_s != old_file_s.to_s
      backup_xls(old_file, output_path) if changed unless old_file.nil?
    end
    return changed
  end
  
  def Series.write_xls_text(series_data, output_path)
    File.open(output_path + '.txt', 'w') do |f|
      series_data.keys.sort.each {|s| f.print(s.split('.')[0] + "\r\n") }
    end
  end
  
  def Series.backup_xls(old_file, output_path)
    output_filename = output_path.split('/')[-1]
    Dir.mkdir output_path+'_vintages' unless File::directory?(output_path+'_vintages')
    open(output_path+"_vintages/#{Date.today}_"+output_filename, 'wb') { |file| file.write old_file }
  end
end

