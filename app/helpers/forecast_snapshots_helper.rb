module ForecastSnapshotsHelper

  def generate_date_range_controls(table_start, table_end)
    ' From ' + select_tag('table_start', options_for_select(@all_dates.each_with_index.to_a, table_start)) +
      ' To ' + select_tag('table_end',   options_for_select(@all_dates.each_with_index.to_a, table_end))
  end

end
