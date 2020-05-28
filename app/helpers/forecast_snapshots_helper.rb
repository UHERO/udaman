module ForecastSnapshotsHelper

  def generate_date_range_controls(table_start, table_end)
    date_f = @all_dates.any? {|s| s =~ /-(04|07|10)-/ } ? lambda {|d| date_to_qspec(d) } : lambda {|d| d[0..3] }
    start_menu_list = @all_dates.each_with_index.to_a.map {|d, i| [date_f.call(d), i, { id: "fstab-start-#{i}" }] }
      end_menu_list = @all_dates.each_with_index.to_a.map {|d, i| [date_f.call(d), i, { id: "fstab-end-#{i}" }] }
    select_tag('table_start', options_for_select(start_menu_list, table_start)) + ' from-to ' +
    select_tag('table_end',   options_for_select(end_menu_list, table_end))
  end

  def forecast_snapshot_csv_gen
    CSV.generate do |csv|
      newfoo  = @tsd_files[0].get_all_series
      oldfoo  = @tsd_files[1].get_all_series
      histfoo = @tsd_files[2].get_all_series
      names = (newfoo + oldfoo + histfoo).map {|s| s[:udaman_series].name }.sort.uniq
      all_dates = newfoo.get_all_dates | oldfoo.get_all_dates | histfoo.get_all_dates
      data = {}
      csv << ['Date'] + names.map {|name| [name + ' (n)', name + ' (o)', name + ' (h)'] }.flatten
      all_dates.each do |date|
        #newval = data[:new][name][date] rescue nil
        #oldval = data[:old][name][date] rescue nil
        #histval = data[:hist][name][date] rescue nil
        csv << [date] + names.map {|name| [newval, oldval, histval] }.flatten
      end
    end
  end

end
