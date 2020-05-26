module ForecastSnapshotsHelper

  def generate_date_range_controls(table_start, table_end)
    is_quar = @all_dates.any? {|s| s =~ /-(04|07|10)-/ }
    menu_list = @all_dates.each_with_index.to_a.map {|d, i| [is_quar ? date_to_qspec(d) : d[0..3], i] }
    select_tag('table_start', options_for_select(menu_list, table_start)) + ' from-to ' +
    select_tag('table_end',   options_for_select(menu_list, table_end))
  end

end
