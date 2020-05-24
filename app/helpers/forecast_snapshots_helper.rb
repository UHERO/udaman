module ForecastSnapshotsHelper

  def generate_date_range_controls(table_start, table_end)
    ' From ' + select_tag('table_start', options_for_select(@all_dates, table_start)) +
    ' To ' + select_tag('table_end', options_for_select(@all_dates, table_end))
  end

end
