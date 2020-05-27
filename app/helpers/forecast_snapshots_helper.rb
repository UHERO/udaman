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
=begin
      series_data = @export.series_data
      names = Export.connection.execute(%Q|SELECT series.name AS name
          FROM export_series
          LEFT JOIN series ON series.id = export_series.series_id
          WHERE export_series.export_id = #{@export.id}
          ORDER BY export_series.list_order;|).to_a.flatten
=end
      dates_array = @export.data_dates
      csv << ['date'] + names
      dates_array.each do |date|
        csv << [date] + names.map {|series_name| series_data[series_name][date]}
      end
    end
  end
end
