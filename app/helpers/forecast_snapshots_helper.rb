module ForecastSnapshotsHelper

  def generate_date_range_controls(table_start, table_end)
    date_f = @all_dates.any? {|s| s =~ /-(04|07|10)-/ } ? lambda {|d| date_to_qspec(d) } : lambda {|d| d[0..3] }
    start_menu_list = @all_dates.each_with_index.to_a.map {|d, i| [date_f.call(d), i, { id: "fstab-start-#{i}" }] }
    end_menu_list   = @all_dates.each_with_index.to_a.map {|d, i| [date_f.call(d), i, { id: "fstab-end-#{i}" }] }
    select_tag('table_start', options_for_select(start_menu_list, table_start)) + ' from-to ' +
    select_tag('table_end',   options_for_select(end_menu_list, table_end))
  end

  def data_portal_link(series)
    unless series.class == Series
      series = series.ts or return "Not an existing series name: #{series}"
    end
    '<a href="https://data.uhero.hawaii.edu/#/series?id=%d" title="Data portal">%s</a>' % [series.id, series.name]
  end

  def forecast_snapshot_csv_gen
    CSV.generate do |csv|                                                                    ## save memory by 86ing unneeded bits
      newstuff = @tsd_files[0].get_all_series.map {|hash| hash.tap {|h| h[:name] += ' (new)'; h[:data] = h[:yoy_hash] = nil } }
      oldstuff = @tsd_files[1].get_all_series.map {|hash| hash.tap {|h| h[:name] += ' (old)'; h[:data] = h[:yoy_hash] = nil } }
      hisstuff = @tsd_files[2].get_all_series.map {|hash| hash.tap {|h| h[:name] += ' (his)'; h[:data] = h[:yoy_hash] = nil } }
      all = (newstuff + oldstuff + hisstuff).map {|h| [h[:name], h] }.to_h
      names = all.keys.sort do |a, b|
        (a0, a1) = a.split
        (b0, b1) = b.split
        fc = { '(new)' => 0, '(old)' => 1, '(his)' => 2 }
        (a0 <=> b0) == 0 ? fc[a1] <=> fc[b1] : a0 <=> b0
      end
      dates = []
      all.each do |_, v|
        dates |= v[:data_hash].keys
      end
      csv << ['Date'] + names
      dates.sort.each do |date|
        csv << [date] + names.map {|name| '%0.3f' % all[name][:data_hash][date] rescue nil }
      end
    end
  end
end
