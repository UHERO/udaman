module HelperUtilities
  ## Return the month number corresponding to start of quarter number passed in
  ## e.g. first_month_of_quarter(3) => 7
  def first_month_of_quarter(q)
    qnum = q.to_s.gsub(/\D/,'').to_i  ## allow for caller to pass things like "Q2"
    raise "first_month_of_quarter: Invalid quarter number in #{q}" unless [1,2,3,4].include? qnum
    (qnum - 1) * 3 + 1
  end

  ## Put in month number, get out quarter number
  ## e.g. quarter_by_month(11) => 4
  def quarter_by_month(mon)
    raise "quarter_by_month: Invalid month number #{mon}" unless 0 < mon.to_i && mon.to_i < 13
    (mon.to_i - 1) / 3 + 1
  end

  ## Put in quarter spec like YYYYQ1, YYYY-Q1, YYYY/Q1, YYYY-Q01, "YYYY Q1", "YYYY Q01", etc
  ## get out date form, e.g. qspec_to_date("2012Q2") => "2012-04-01"
  def qspec_to_date(qstr)
    return nil unless qstr =~ /([12]\d\d\d)[-.\/ ]*Q0?([1234])/i
    '%s-%02d-01' % [$1, first_month_of_quarter($2)]
  end

  ## Put in date (either string or Date object), get out quarter spec; opt. second param is delimiter string
  ## e.g. date_to_qspec("2018-03-01") => "2018Q1", date_to_qspec("2018-10-01", "-") => "2018-Q4"
  def date_to_qspec(date, delim = nil)
    unless date.class === Date
      date = Date.parse(date) rescue raise("date_to_qspec: parameter #{date} not a proper date string")
    end
    '%s%sQ%d' % [date.year, delim, quarter_by_month(date.mon)]
  end

  ## Calculate difference in months between dates. Days are not considered, only whole months.
  ## Params can be passed as Date or String.
  def delta_months(start_date, end_date)
    unless start_date.class == Date
      start_date = Date.parse(start_date) rescue raise("delta_months: parameter #{start_date} not a proper date string")
    end
    unless end_date.class == Date
      end_date = Date.parse(end_date) rescue raise("delta_months: parameter #{end_date} not a proper date string")
    end
    if end_date < start_date
      Rails.logger.warn { 'delta_months: dates are in reverse of expected order, giving negative result' }
    end
    (end_date.year - start_date.year) * 12 + end_date.month - start_date.month
  end
end
