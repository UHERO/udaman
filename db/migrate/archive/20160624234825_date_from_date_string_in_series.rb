class DateFromDateStringInSeries < ActiveRecord::Migration
  def change
    Series.update_all 'last_demetra_date = last_demetra_datestring'
  end
end
