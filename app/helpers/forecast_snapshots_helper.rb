module ForecastSnapshotsHelper

  def generate_date_range_controls(table_start, table_end)
    select_tag('table_start', options_for_select(@all_dates, table_start)) +
    select_tag('table_end', options_for_select(@all_dates, table_end))
  end

end
