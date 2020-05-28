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
      histfoo = @tsd_files[2].get_all_series.map {|hash| hash.tap {|h| h[:name] += ' (h)'; h[:data] = nil } } ## save mem by 86ing unneeded bits
      oldfoo  = @tsd_files[1].get_all_series.map {|hash| hash.tap {|h| h[:name] += ' (o)'; h[:data] = nil } }
      newfoo  = @tsd_files[0].get_all_series.map {|hash| hash.tap {|h| h[:name] += ' (n)'; h[:data] = nil } }
      all = (newfoo + oldfoo + histfoo).map {|h| [h[:name], h] }.to_h
      names = all.keys.sort
      all_dates = []
      all.each do |_, v|
        all_dates |= v[:data_hash].keys
      end
      csv << ['Date'] + names
      all_dates.sort.each do |date|
        csv << [date] + names.map {|name| all[name][:data_hash][date] rescue nil }
      end
    end
  end

end
