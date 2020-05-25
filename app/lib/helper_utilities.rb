module HelperUtilities
  ## Return the month number corresponding to start of quarter number passed in
  ## e.g. first_month_of_quarter(3) => 7
  def first_month_of_quarter(q)
    qnum = q.to_s.gsub(/\D/,'').to_i  ## allow for caller to pass things like "Q2"
    (qnum - 1) * 3 + 1
  end

  def convert_qspec_to_date(qstr)
    ## Quarter spec like YYYYQ1, YYYY-Q1, YYYY/Q1, YYYY-Q01, "YYYY Q1", "YYYY Q01", etc
    return nil unless qstr =~ /([12]\d\d\d)[-.\/ ]*Q0?([1234])/i
    '%s-%02d-01' % [$1, first_month_of_quarter($2)]
  end

  def convert_date_to_qspec(date)
    unless date.class === Date
      date = Date.parse date
    end
    '%sQ%d' % [date.year, quarter_by_month(date.mon)]
  end

  ## Put in month number, get out quarter number
  def quarter_by_month(mon)
    (mon.to_i - 1) / 3 + 1
  end
end
